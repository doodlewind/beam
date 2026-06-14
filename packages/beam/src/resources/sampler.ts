// ============================================================================
// Sampler — immutable. Maps Wrap/Filter to GPUAddressMode/GPUFilterMode.
// ============================================================================

import type { Sampler, SamplerOpts, Wrap, Filter } from '../types'

function addressMode(w: Wrap): GPUAddressMode {
  switch (w) {
    case 'repeat':
      return 'repeat'
    case 'mirror':
      return 'mirror-repeat'
    case 'clamp':
      return 'clamp-to-edge'
  }
}

function filterMode(f: Filter): GPUFilterMode {
  return f === 'nearest' ? 'nearest' : 'linear'
}

function mipmapMode(f: Filter): GPUMipmapFilterMode {
  return f === 'nearest' ? 'nearest' : 'linear'
}

class SamplerImpl implements Sampler {
  readonly kind = 'sampler' as const
  readonly gpu: GPUSampler

  constructor(device: GPUDevice, opts: SamplerOpts) {
    const wrap = opts.wrap ?? 'clamp'
    let u: Wrap, v: Wrap, w: Wrap
    if (Array.isArray(wrap)) {
      u = wrap[0]
      v = wrap[1]
      w = wrap[2] ?? wrap[1]
    } else {
      u = v = w = wrap
    }

    const desc: GPUSamplerDescriptor = {
      addressModeU: addressMode(u),
      addressModeV: addressMode(v),
      addressModeW: addressMode(w),
      magFilter: filterMode(opts.mag ?? 'linear'),
      minFilter: filterMode(opts.min ?? 'linear'),
      mipmapFilter: mipmapMode(opts.mip ?? 'linear'),
    }
    if (opts.compare) desc.compare = opts.compare
    this.gpu = device.createSampler(desc)
  }
}

export function makeSampler(
  device: GPUDevice,
  opts: SamplerOpts = {}
): Sampler {
  return new SamplerImpl(device, opts)
}
