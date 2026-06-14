// ============================================================================
// bindings.ts — draw glue. Resolve a keyed Bindings object into the concrete
// GPU state one draw needs: bind groups (by group index), ordered vertex
// buffers, index info, and vertex/instance counts. DESIGN §1, §3.4.
//
// Bind groups are cached by resource identity: a per-pipeline WeakMap keyed by
// the resource object(s) so repeated draws with the same resources reuse the
// same GPUBindGroup. Mutating a resource via .set keeps buffer identity (cache
// hit); allocating a new resource makes a fresh group.
// ============================================================================

import type { Bindings, BindGroup, Index, Pipeline } from './types'
import { pipelineInternal } from './pipeline'
import { beamError } from './errors'

// ---- Resolved draw state ----------------------------------------------------

export interface ResolvedGroup {
  index: number
  gpu: GPUBindGroup
}

export interface ResolvedIndex {
  buffer: GPUBuffer
  format: GPUIndexFormat
  count: number
  offset: number
}

export interface ResolvedBindings {
  groups: ResolvedGroup[]
  /** Vertex buffers in setVertexBuffer slot order (== @location order). */
  vertexBuffers: GPUBuffer[]
  index: ResolvedIndex | null
  /** Element count to draw (index count if indexed, else vertex count). */
  vertexCount: number
  instanceCount: number
}

// ---- Per-pipeline bind group cache ------------------------------------------

// One cache per pipeline. group0 keys directly on the uniforms resource.
// group1 keys on the *ordered tuple* of texture+sampler resources via a chain
// of nested WeakMaps, so a built GPUBindGroup is reused only when every
// resource in the set matches by identity. Mutating a resource via .set keeps
// its object identity (cache hit); a new resource yields a fresh group.
interface GroupCache {
  group0: WeakMap<object, GPUBindGroup>
  group1: WeakMap<object, GroupNode>
  /** The single empty group(0) for textures-only pipelines (built once). */
  group0Empty?: GPUBindGroup
}

// Node in the nested-WeakMap chain: `next` walks to the next resource in the
// tuple; `leaf` holds the built group once the whole tuple is consumed.
interface GroupNode {
  leaf?: GPUBindGroup
  next: WeakMap<object, GroupNode>
}

const caches = new WeakMap<Pipeline, GroupCache>()

function cacheFor(pipeline: Pipeline): GroupCache {
  let c = caches.get(pipeline)
  if (!c) {
    c = { group0: new WeakMap(), group1: new WeakMap() }
    caches.set(pipeline, c)
  }
  return c
}

/** Walk/extend the nested-WeakMap chain to the leaf node for a resource tuple. */
function chainNode(
  root: WeakMap<object, GroupNode>,
  keys: object[]
): GroupNode {
  let map = root
  let node: GroupNode | undefined
  for (const key of keys) {
    node = map.get(key)
    if (!node) {
      node = { next: new WeakMap() }
      map.set(key, node)
    }
    map = node.next
  }
  // keys is always non-empty when hasTextures is true.
  return node as GroupNode
}

function resolveIndex(index: Index | undefined): ResolvedIndex | null {
  if (!index) return null
  return {
    buffer: index.buffer,
    format: index.format,
    count: index.count,
    offset: index.offset,
  }
}

/**
 * Resolve a Bindings object against a pipeline into concrete draw state. If
 * `bindings.groups` is provided, those bind groups are used verbatim (power
 * path); otherwise groups are built from `uniforms` / `textures` / `samplers`
 * against the pipeline's explicit layouts and cached by resource identity.
 */
export function resolveBindings(
  device: GPUDevice,
  pipeline: Pipeline,
  bindings: Bindings
): ResolvedBindings {
  const info = pipelineInternal(pipeline)

  // ---- vertex buffers in @location order ----
  const verts = bindings.verts
  if (!verts) throw beamError('draw', 'bindings.verts is required')
  const vertexBuffers: GPUBuffer[] = info.vertexOrder.map((key) => {
    const buf = verts.buffers[key]
    if (!buf) throw beamError('draw', `missing vertex attribute "${key}"`)
    return buf
  })

  const index = resolveIndex(bindings.index)
  const vertexCount = index ? index.count : verts.count
  const instanceCount = bindings.instances ?? 1

  // ---- bind groups ----
  const groups: ResolvedGroup[] = []

  if (bindings.groups) {
    // Power path: caller supplied prebuilt BindGroups.
    for (const g of bindings.groups as BindGroup[]) {
      groups.push({ index: g.index, gpu: g.gpu })
    }
    return { groups, vertexBuffers, index, vertexCount, instanceCount }
  }

  const cache = cacheFor(pipeline)

  // group(0): uniforms
  if (info.hasUniforms) {
    const uniforms = bindings.uniforms
    if (!uniforms) {
      throw beamError('draw', 'pipeline requires bindings.uniforms')
    }
    let gpu = cache.group0.get(uniforms)
    if (!gpu) {
      gpu = device.createBindGroup({
        label: 'draw:group0',
        layout: info.uniformLayout as GPUBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniforms.buffer } }],
      })
      cache.group0.set(uniforms, gpu)
    }
    groups.push({ index: 0, gpu })
  }

  // group(1): textures (0..T-1) then samplers (T..T+S-1)
  if (info.hasTextures) {
    const textures = bindings.textures ?? {}
    const samplers = bindings.samplers ?? {}

    // Resolve resources in schema order; collect their identities for the
    // cache key (the ordered tuple of texture then sampler resources).
    const keyTuple: object[] = []
    const entries: GPUBindGroupEntry[] = []

    info.textureOrder.forEach((key, i) => {
      const tex = (
        textures as Record<string, { view: GPUTextureView; gpu: GPUTexture }>
      )[key]
      if (!tex) throw beamError('draw', `missing texture "${key}"`)
      // Key on the underlying GPUTexture, not the wrapper: a resize/format
      // change recreates the GPUTexture (new identity) and must invalidate the
      // cached bind group, while a same-size re-upload keeps it (cache hit).
      keyTuple.push(tex.gpu)
      entries.push({ binding: i, resource: tex.view })
    })
    info.samplerOrder.forEach((key, i) => {
      const samp = (samplers as Record<string, { gpu: GPUSampler }>)[key]
      if (!samp) throw beamError('draw', `missing sampler "${key}"`)
      keyTuple.push(samp)
      entries.push({
        binding: info.textureOrder.length + i,
        resource: samp.gpu,
      })
    })

    const node = chainNode(cache.group1, keyTuple)
    let gpu = node.leaf
    if (!gpu) {
      gpu = device.createBindGroup({
        label: 'draw:group1',
        layout: info.textureLayout as GPUBindGroupLayout,
        entries,
      })
      node.leaf = gpu
    }
    groups.push({ index: 1, gpu })
  }

  // When textures exist but uniforms do not, the pipeline layout still declares
  // an (empty) group(0); bind an empty group there or the draw fails WebGPU's
  // bind-group completeness validation. Built once per pipeline.
  if (info.hasTextures && !info.hasUniforms && info.emptyGroup0Layout) {
    let empty = cache.group0Empty
    if (!empty) {
      empty = device.createBindGroup({
        label: 'draw:group0-empty',
        layout: info.emptyGroup0Layout,
        entries: [],
      })
      cache.group0Empty = empty
    }
    groups.push({ index: 0, gpu: empty })
  }

  return { groups, vertexBuffers, index, vertexCount, instanceCount }
}
