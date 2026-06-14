// ============================================================================
// Texture — 2D + cube (cube flag). srgb format selection, flipY, mip generation.
// Factories makeTexture / makeCube. DESIGN §2.3.
// ============================================================================

import type { Texture, TextureSource, TextureOpts, CubeFaces } from '../types'
import { beamError } from '../errors'

// ---- Source measuring -------------------------------------------------------

interface RawSource {
  data: BufferSource
  width: number
  height: number
}

function isRaw(s: TextureSource): s is RawSource {
  return (s as RawSource).data !== undefined
}

function sourceSize(s: TextureSource): { width: number; height: number } {
  if (isRaw(s)) return { width: s.width, height: s.height }
  if (s instanceof HTMLVideoElement) {
    return { width: s.videoWidth, height: s.videoHeight }
  }
  return {
    width: (s as { width: number }).width,
    height: (s as { height: number }).height,
  }
}

function defaultFormat(opts: TextureOpts): GPUTextureFormat {
  if (opts.format) return opts.format
  return opts.srgb ? 'rgba8unorm-srgb' : 'rgba8unorm'
}

function mipCount(w: number, h: number): number {
  return 1 + Math.floor(Math.log2(Math.max(w, h)))
}

// ---- Mip generation (render-based, linear-sampled downsample) ---------------

const MIP_WGSL = `
@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;

struct VsOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VsOut {
  // Fullscreen triangle.
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let xy = p[i];
  var out: VsOut;
  out.pos = vec4f(xy, 0.0, 1.0);
  out.uv = vec2f((xy.x + 1.0) * 0.5, 1.0 - (xy.y + 1.0) * 0.5);
  return out;
}

@fragment
fn fs(in: VsOut) -> @location(0) vec4f {
  return textureSample(src, samp, in.uv);
}
`

interface MipPipeline {
  pipeline: GPURenderPipeline
  sampler: GPUSampler
}

// One mip pipeline per (device, format) — keyed off the device.
const mipPipelines = new WeakMap<GPUDevice, Map<string, MipPipeline>>()

function getMipPipeline(
  device: GPUDevice,
  format: GPUTextureFormat
): MipPipeline {
  let perDevice = mipPipelines.get(device)
  if (!perDevice) {
    perDevice = new Map()
    mipPipelines.set(device, perDevice)
  }
  const cached = perDevice.get(format)
  if (cached) return cached

  const module = device.createShaderModule({ code: MIP_WGSL })
  const pipeline = device.createRenderPipeline({
    label: 'beam:mipgen',
    layout: 'auto', // internal-only helper; never user-visible layout
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  })
  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  })
  const result = { pipeline, sampler }
  perDevice.set(format, result)
  return result
}

/** Generate mips for `texture` (2D, all array layers) by chained downsampling. */
function generateMips(
  device: GPUDevice,
  texture: GPUTexture,
  format: GPUTextureFormat
): void {
  const { pipeline, sampler } = getMipPipeline(device, format)
  const encoder = device.createCommandEncoder({ label: 'beam:mipgen' })
  const layers = texture.depthOrArrayLayers

  for (let layer = 0; layer < layers; layer++) {
    for (let level = 1; level < texture.mipLevelCount; level++) {
      const srcView = texture.createView({
        dimension: '2d',
        baseMipLevel: level - 1,
        mipLevelCount: 1,
        baseArrayLayer: layer,
        arrayLayerCount: 1,
      })
      const dstView = texture.createView({
        dimension: '2d',
        baseMipLevel: level,
        mipLevelCount: 1,
        baseArrayLayer: layer,
        arrayLayerCount: 1,
      })
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: srcView },
          { binding: 1, resource: sampler },
        ],
      })
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          { view: dstView, loadOp: 'clear', storeOp: 'store' },
        ],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(3)
      pass.end()
    }
  }
  device.queue.submit([encoder.finish()])
}

// ---- Texture implementation -------------------------------------------------

class TextureImpl implements Texture {
  readonly kind = 'texture' as const
  readonly cube: boolean

  #device: GPUDevice
  #label: string
  #gpu: GPUTexture | null = null
  #format: GPUTextureFormat = 'rgba8unorm'
  #usage: GPUTextureUsageFlags
  #hasMips = false

  constructor(
    device: GPUDevice,
    cube: boolean,
    source: TextureSource | CubeFaces | undefined,
    opts: TextureOpts,
    label: string
  ) {
    this.#device = device
    this.cube = cube
    this.#label = label
    this.#usage =
      opts.usage ??
      GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT
    if (source) this.set(source, opts)
  }

  set(source: TextureSource | CubeFaces, opts: TextureOpts = {}): this {
    if (this.cube) return this.#setCube(source as CubeFaces, opts)
    return this.#set2D(source as TextureSource, opts)
  }

  #ensureTexture(
    width: number,
    height: number,
    layers: number,
    opts: TextureOpts
  ): GPUTexture {
    const format = defaultFormat(opts)
    const mips = !!opts.mips
    const mipLevelCount = mips ? mipCount(width, height) : 1
    const usage = mips
      ? this.#usage | GPUTextureUsage.RENDER_ATTACHMENT
      : this.#usage

    const existing = this.#gpu
    if (
      existing &&
      existing.width === width &&
      existing.height === height &&
      existing.depthOrArrayLayers === layers &&
      existing.format === format &&
      existing.mipLevelCount === mipLevelCount
    ) {
      this.#format = format
      this.#hasMips = mips
      return existing
    }
    existing?.destroy()
    const tex = this.#device.createTexture({
      label: this.#label,
      size: { width, height, depthOrArrayLayers: layers },
      format,
      usage,
      mipLevelCount,
      dimension: '2d',
    })
    this.#gpu = tex
    this.#format = format
    this.#hasMips = mips
    return tex
  }

  #copySource(
    source: TextureSource,
    tex: GPUTexture,
    width: number,
    height: number,
    layer: number,
    flipY: boolean
  ): void {
    if (isRaw(source)) {
      // Raw bytes: assume 4 bytes/px (rgba8) tightly packed. Honor flipY by
      // reversing the row order before upload (writeTexture has no flip option).
      const bytesPerRow = width * 4
      let data: BufferSource = source.data
      if (flipY) {
        const src =
          source.data instanceof ArrayBuffer
            ? new Uint8Array(source.data)
            : new Uint8Array(
                source.data.buffer,
                source.data.byteOffset,
                source.data.byteLength
              )
        const flipped = new Uint8Array(bytesPerRow * height)
        for (let row = 0; row < height; row++) {
          flipped.set(
            src.subarray(row * bytesPerRow, (row + 1) * bytesPerRow),
            (height - 1 - row) * bytesPerRow
          )
        }
        data = flipped
      }
      this.#device.queue.writeTexture(
        { texture: tex, origin: { x: 0, y: 0, z: layer } },
        data,
        { bytesPerRow, rowsPerImage: height },
        { width, height }
      )
      return
    }
    this.#device.queue.copyExternalImageToTexture(
      { source, flipY },
      { texture: tex, origin: { x: 0, y: 0, z: layer } },
      { width, height }
    )
  }

  #set2D(source: TextureSource, opts: TextureOpts): this {
    const { width, height } = sourceSize(source)
    if (width === 0 || height === 0) {
      throw beamError(this.#label, 'texture source has zero size')
    }
    const tex = this.#ensureTexture(width, height, 1, opts)
    this.#copySource(source, tex, width, height, 0, !!opts.flipY)
    if (this.#hasMips) generateMips(this.#device, tex, this.#format)
    return this
  }

  #setCube(faces: CubeFaces, opts: TextureOpts): this {
    const { width, height } = sourceSize(faces[0])
    if (width === 0 || height === 0) {
      throw beamError(this.#label, 'cube face has zero size')
    }
    const tex = this.#ensureTexture(width, height, 6, opts)
    for (let i = 0; i < 6; i++) {
      this.#copySource(
        faces[i] as TextureSource,
        tex,
        width,
        height,
        i,
        !!opts.flipY
      )
    }
    if (this.#hasMips) generateMips(this.#device, tex, this.#format)
    return this
  }

  get gpu(): GPUTexture {
    if (!this.#gpu) throw beamError(this.#label, 'texture not set')
    return this.#gpu
  }

  get view(): GPUTextureView {
    return this.gpu.createView({
      dimension: this.cube ? 'cube' : '2d',
    })
  }

  destroy(): void {
    this.#gpu?.destroy()
    this.#gpu = null
  }
}

export function makeTexture(
  device: GPUDevice,
  source?: TextureSource,
  opts: TextureOpts = {},
  label = 'texture'
): Texture {
  return new TextureImpl(device, false, source, opts, label)
}

export function makeCube(
  device: GPUDevice,
  faces?: CubeFaces,
  opts: TextureOpts = {},
  label = 'cube'
): Texture {
  return new TextureImpl(device, true, faces, opts, label)
}
