// ============================================================================
// Pipeline<V,U,T,S> — wraps a GPURenderPipeline + explicit bind group layouts
// derived from the schema. NEVER layout:'auto' (DESIGN §2.2/§6).
//
// Layout convention (DESIGN §4):
//  - group(0): one uniform buffer at @binding(0) — present iff uniforms non-empty.
//  - group(1): textures @binding(0..T-1) then samplers @binding(T..T+S-1) —
//    present iff textures or samplers non-empty.
// ============================================================================

import type {
  BindLayout,
  Pipeline,
  PipelineTemplate,
  Primitive,
  Cull,
  Blend,
  DepthOpts,
  ColorTarget,
  VertexSchema,
  UniformSchema,
  TextureSchema,
  SamplerSchema,
  TexType,
  SampType,
} from './types'
import { vertexLayout } from './schema'
import { beamError, DEV } from './errors'

// ---- Preset maps ------------------------------------------------------------

function topology(p: Primitive | undefined): GPUPrimitiveTopology {
  switch (p) {
    case 'tri-strip':
      return 'triangle-strip'
    case 'line':
      return 'line-list'
    case 'point':
      return 'point-list'
    case 'tri':
    case undefined:
      return 'triangle-list'
  }
}

function cullMode(c: Cull | undefined): GPUCullMode {
  return c ?? 'none'
}

function blendState(b: Blend | undefined): GPUBlendState | undefined {
  switch (b) {
    case 'alpha':
      return {
        color: {
          srcFactor: 'src-alpha',
          dstFactor: 'one-minus-src-alpha',
          operation: 'add',
        },
        alpha: {
          srcFactor: 'one',
          dstFactor: 'one-minus-src-alpha',
          operation: 'add',
        },
      }
    case 'add':
      return {
        color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
      }
    case 'none':
    case undefined:
      return undefined
  }
}

const DEFAULT_DEPTH_FORMAT: GPUTextureFormat = 'depth24plus'

/** Resolve the depth-stencil descriptor from the `depth` preset (bool | opts). */
function depthStencil(
  depth: boolean | DepthOpts | undefined
): GPUDepthStencilState | undefined {
  if (!depth) return undefined
  const opts: DepthOpts = depth === true ? {} : depth
  return {
    format: opts.format ?? DEFAULT_DEPTH_FORMAT,
    depthWriteEnabled: opts.write ?? true,
    depthCompare: opts.compare ?? (opts.test === false ? 'always' : 'less'),
  }
}

// ---- Texture / sampler layout entry types -----------------------------------

function viewDimension(t: TexType): GPUTextureViewDimension {
  return t === 'texCube' ? 'cube' : '2d'
}

function sampleType(t: TexType): GPUTextureSampleType {
  return t === 'texDepth' ? 'depth' : 'float'
}

function samplerBindingType(s: SampType): GPUSamplerBindingType {
  if (s === 'samplerCompare') return 'comparison'
  if (s === 'samplerNonFilter') return 'non-filtering'
  return 'filtering'
}

// ---- Internal pipeline shape (consumed by bindings.ts) ----------------------

/**
 * Non-public accessor surface for the draw glue. bindings.ts reads these to
 * know which groups exist and to reuse the exact GPUBindGroupLayout objects.
 */
export interface PipelineInternal {
  /** group(0) layout, present iff uniforms schema is non-empty. */
  readonly uniformLayout: GPUBindGroupLayout | null
  /** group(1) layout, present iff textures or samplers non-empty. */
  readonly textureLayout: GPUBindGroupLayout | null
  /**
   * Empty group(0) layout, present iff textures exist but uniforms do NOT (the
   * pipeline layout still references group 0, so the draw must bind an empty
   * group there to satisfy WebGPU's bind-group completeness validation).
   */
  readonly emptyGroup0Layout: GPUBindGroupLayout | null
  /** Whether group 0 (uniforms) exists. */
  readonly hasUniforms: boolean
  /** Whether group 1 (textures+samplers) exists. */
  readonly hasTextures: boolean
  /** Vertex attribute keys in @location / setVertexBuffer slot order. */
  readonly vertexOrder: string[]
  /** Texture keys in @binding order (binding 0..T-1). */
  readonly textureOrder: string[]
  /** Sampler keys in @binding order (binding T..T+S-1). */
  readonly samplerOrder: string[]
}

const internals = new WeakMap<Pipeline, PipelineInternal>()

/** Retrieve the internal pipeline view (for bindings.ts / bind.ts). */
export function pipelineInternal(pipeline: Pipeline): PipelineInternal {
  const i = internals.get(pipeline)
  if (!i) throw beamError('pipeline', 'not a beam pipeline')
  return i
}

// ---- Pipeline implementation ------------------------------------------------

class PipelineImpl<
  V extends VertexSchema,
  U extends UniformSchema,
  T extends TextureSchema,
  S extends SamplerSchema,
> implements Pipeline<V, U, T, S> {
  readonly gpu: GPURenderPipeline
  readonly schema: { vertex: V; uniforms: U; textures: T; samplers: S }

  #uniformLayout: GPUBindGroupLayout | null
  #textureLayout: GPUBindGroupLayout | null

  constructor(
    gpu: GPURenderPipeline,
    schema: { vertex: V; uniforms: U; textures: T; samplers: S },
    uniformLayout: GPUBindGroupLayout | null,
    textureLayout: GPUBindGroupLayout | null
  ) {
    this.gpu = gpu
    this.schema = schema
    this.#uniformLayout = uniformLayout
    this.#textureLayout = textureLayout
  }

  group(i: number): BindLayout {
    if (i === 0) {
      if (!this.#uniformLayout) {
        throw beamError('pipeline', 'group(0) has no uniforms')
      }
      return { gpu: this.#uniformLayout, index: 0 }
    }
    if (i === 1) {
      if (!this.#textureLayout) {
        throw beamError('pipeline', 'group(1) has no textures/samplers')
      }
      return { gpu: this.#textureLayout, index: 1 }
    }
    throw beamError('pipeline', `no bind group ${i} (only 0 and 1 exist)`)
  }
}

/**
 * Build a Pipeline from a template. Creates the shader module, explicit bind
 * group layouts, a pipeline layout, and the render pipeline. Wrapped in a
 * validation error scope in dev (createRenderPipeline is sync; the scope is
 * popped asynchronously and surfaces errors to the console).
 */
export function makePipeline<
  V extends VertexSchema,
  U extends UniformSchema = {},
  T extends TextureSchema = {},
  S extends SamplerSchema = {},
>(
  device: GPUDevice,
  format: GPUTextureFormat,
  template: PipelineTemplate<V, U, T, S>
): Pipeline<V, U, T, S> {
  const label = template.label ?? 'pipeline'

  const uniformSchema = (template.uniforms ?? {}) as U
  const textureSchema = (template.textures ?? {}) as T
  const samplerSchema = (template.samplers ?? {}) as S

  const uniformKeys = Object.keys(uniformSchema)
  const textureOrder = Object.keys(textureSchema)
  const samplerOrder = Object.keys(samplerSchema)

  // ---- group(0): uniforms -> one UBO at @binding(0) ----
  let uniformLayout: GPUBindGroupLayout | null = null
  if (uniformKeys.length > 0) {
    uniformLayout = device.createBindGroupLayout({
      label: `${label}:group0`,
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' },
        },
      ],
    })
  }

  // ---- group(1): textures (0..T-1) then samplers (T..T+S-1) ----
  let textureLayout: GPUBindGroupLayout | null = null
  if (textureOrder.length > 0 || samplerOrder.length > 0) {
    const entries: GPUBindGroupLayoutEntry[] = []
    textureOrder.forEach((key, i) => {
      const t = textureSchema[key] as TexType
      entries.push({
        binding: i,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {
          sampleType: sampleType(t),
          viewDimension: viewDimension(t),
        },
      })
    })
    samplerOrder.forEach((key, i) => {
      const s = samplerSchema[key] as SampType
      entries.push({
        binding: textureOrder.length + i,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: samplerBindingType(s) },
      })
    })
    textureLayout = device.createBindGroupLayout({
      label: `${label}:group1`,
      entries,
    })
  }

  const bindGroupLayouts: GPUBindGroupLayout[] = []
  let emptyGroup0Layout: GPUBindGroupLayout | null = null
  if (uniformLayout) bindGroupLayouts[0] = uniformLayout
  if (textureLayout) {
    // group index 1 — if group 0 is absent, fill slot 0 with an empty layout so
    // the texture layout still lands at @group(1). The draw glue must bind an
    // empty group(0) against this layout (bind-group completeness).
    if (!uniformLayout) {
      emptyGroup0Layout = device.createBindGroupLayout({
        label: `${label}:group0-empty`,
        entries: [],
      })
      bindGroupLayouts[0] = emptyGroup0Layout
    }
    bindGroupLayouts[1] = textureLayout
  }

  const pipelineLayout = device.createPipelineLayout({
    label: `${label}:layout`,
    bindGroupLayouts,
  })

  // ---- shader module ----
  const module = device.createShaderModule({
    label: `${label}:wgsl`,
    code: template.wgsl,
  })

  // ---- vertex state ----
  const vl = vertexLayout(template.vertex)
  // WGSL override constants are numeric; coerce booleans to 0/1.
  let constants: Record<string, number> | undefined
  if (template.constants) {
    constants = {}
    for (const k of Object.keys(template.constants)) {
      const v = template.constants[k]
      constants[k] = typeof v === 'boolean' ? (v ? 1 : 0) : (v as number)
    }
  }
  const vertex: GPUVertexState = {
    module,
    entryPoint: template.vsEntry ?? 'vs',
    buffers: vl.buffers,
    ...(constants ? { constants } : {}),
  }

  // ---- fragment targets ----
  const targets: GPUColorTargetState[] = (
    template.targets ?? [{ format, blend: template.blend }]
  ).map((t: ColorTarget) => {
    const tgtFormat = t.format ?? format
    const blend = blendState(t.blend ?? template.blend)
    return blend ? { format: tgtFormat, blend } : { format: tgtFormat }
  })

  const fragment: GPUFragmentState = {
    module,
    entryPoint: template.fsEntry ?? 'fs',
    targets,
    ...(constants ? { constants } : {}),
  }

  // ---- assemble descriptor ----
  const descriptor: GPURenderPipelineDescriptor = {
    label,
    layout: pipelineLayout,
    vertex,
    fragment,
    primitive: {
      topology: topology(template.primitive),
      cullMode: cullMode(template.cull),
    },
    multisample: { count: template.samples ?? 1 },
  }
  const ds = depthStencil(template.depth)
  if (ds) descriptor.depthStencil = ds

  // createRenderPipeline is synchronous; capture validation errors in dev.
  if (DEV) device.pushErrorScope('validation')
  const gpu = device.createRenderPipeline(descriptor)
  if (DEV) {
    void device.popErrorScope().then((err) => {
      if (err) console.error(`[beam:${label}] ${err.message}`)
    })
  }

  const schema = {
    vertex: template.vertex,
    uniforms: uniformSchema,
    textures: textureSchema,
    samplers: samplerSchema,
  }

  const pipeline = new PipelineImpl<V, U, T, S>(
    gpu,
    schema,
    uniformLayout,
    textureLayout
  )

  internals.set(pipeline, {
    uniformLayout,
    textureLayout,
    emptyGroup0Layout,
    hasUniforms: uniformLayout !== null,
    hasTextures: textureLayout !== null,
    vertexOrder: vl.order,
    textureOrder,
    samplerOrder,
  })

  return pipeline
}
