// ============================================================================
// BindGroup / makeBind — the power path for beam.bind(layout, entries).
//
// Numeric keys are @binding indices. Values may be wrapped beam resources
// (Uniforms / Texture / Sampler) or raw GPU objects (GPUBuffer /
// GPUTextureView / GPUSampler). DESIGN §1 "power path".
// ============================================================================

import type { BindEntries, BindGroup, BindLayout, BindResource } from './types'
import { beamError } from './errors'

/**
 * Resolve a BindResource to a GPUBindGroupEntry's `resource` field. Accepts
 * both wrapped resources (discriminated by their `kind`) and raw GPU objects.
 */
function toResource(binding: number, res: BindResource): GPUBindingResource {
  // Wrapped beam resources carry a `kind` tag.
  const kind = (res as { kind?: string }).kind
  if (kind === 'uniforms') {
    return { buffer: (res as { buffer: GPUBuffer }).buffer }
  }
  if (kind === 'texture') {
    return (res as { view: GPUTextureView }).view
  }
  if (kind === 'sampler') {
    return (res as { gpu: GPUSampler }).gpu
  }

  // Raw GPU objects.
  if (res instanceof GPUBuffer) return { buffer: res }
  if (res instanceof GPUTextureView) return res
  if (res instanceof GPUSampler) return res

  throw beamError('bind', `binding ${binding}: unsupported resource`)
}

class BindGroupImpl implements BindGroup {
  readonly gpu: GPUBindGroup
  readonly index: number
  constructor(gpu: GPUBindGroup, index: number) {
    this.gpu = gpu
    this.index = index
  }
}

/**
 * Build a reusable BindGroup against an explicit pipeline layout. `entries`
 * maps @binding index -> resource (wrapped or raw).
 */
export function makeBind(
  device: GPUDevice,
  layout: BindLayout,
  entries: BindEntries
): BindGroup {
  const gpuEntries: GPUBindGroupEntry[] = Object.keys(entries)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((binding) => {
      const res = entries[binding]
      if (res === undefined) {
        throw beamError('bind', `binding ${binding}: missing resource`)
      }
      return { binding, resource: toResource(binding, res) }
    })

  const gpu = device.createBindGroup({
    label: `bind:group${layout.index}`,
    layout: layout.gpu,
    entries: gpuEntries,
  })
  return new BindGroupImpl(gpu, layout.index)
}
