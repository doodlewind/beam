// ============================================================================
// Target — offscreen render-to-texture. DESIGN §2.4, §3.5. Allocates a
// sampleable color GPUTexture (+ optional sampleable depth), exposes them as
// Texture wrappers, and .draw()s identically to beam by recording into the
// current frame's encoder.
//
// MSAA (samples:4) best-effort (DESIGN §3.5): allocate an internal multisample
// color texture and resolve into the single-sample, sampleable `color`. Depth
// is allocated at the pass sample count so it matches the pipeline.
// ============================================================================

import type {
  Bindings,
  Pipeline,
  SamplerSchema,
  Target,
  TargetOpts,
  Texture,
  TextureSchema,
  UniformSchema,
  VertexSchema,
} from './types'
import type { Color, PassSurface } from './pass'
import type { FrameController, FrameSurface } from './frame'
import { beamError } from './errors'

// Default depth format for targets: depth32float is sampleable everywhere,
// which lets shadow-map style examples bind target.depth as texture_depth_2d.
const TARGET_DEPTH_FORMAT: GPUTextureFormat = 'depth32float'

/**
 * A Texture wrapper over a Target's own GPUTexture (color or depth). Unlike the
 * data-layer Texture it is not built from a source and is not mutable via
 * .set; it just exposes .gpu/.view so it can be bound like any Texture.
 */
class ViewTexture implements Texture {
  readonly kind = 'texture' as const
  readonly cube = false
  #tex: GPUTexture
  #dim: GPUTextureViewDimension

  constructor(tex: GPUTexture) {
    this.#tex = tex
    this.#dim = '2d'
  }

  set(): this {
    throw beamError('target', 'target textures are not settable via .set')
  }

  swap(tex: GPUTexture): void {
    this.#tex = tex
  }

  get gpu(): GPUTexture {
    return this.#tex
  }

  get view(): GPUTextureView {
    return this.#tex.createView({ dimension: this.#dim })
  }

  destroy(): void {
    this.#tex.destroy()
  }
}

class TargetImpl implements Target, FrameSurface {
  readonly id: object = {}

  #device: GPUDevice
  #frame: FrameController
  #format: GPUTextureFormat
  #depthFormat: GPUTextureFormat | null
  #samples: 1 | 4
  #label: string

  #width: number
  #height: number

  // Single-sample, sampleable color (the resolve target / direct attachment).
  #colorTex!: GPUTexture
  #colorWrap!: ViewTexture
  // Internal MSAA color (samples:4 only); resolved into #colorTex.
  #msaaColor: GPUTexture | null = null

  #depthTex: GPUTexture | null = null
  #depthWrap: ViewTexture | null = null

  constructor(
    device: GPUDevice,
    frame: FrameController,
    opts: TargetOpts,
    defaultFormat: GPUTextureFormat
  ) {
    this.#device = device
    this.#frame = frame
    // Default the color format to the beam screen format so a pipeline built
    // with no explicit `targets` (which bakes in beam.format) matches the
    // target's color attachment — otherwise the draw fails format validation.
    this.#format = opts.format ?? defaultFormat
    this.#depthFormat = opts.depth ? TARGET_DEPTH_FORMAT : null
    this.#samples = opts.samples ?? 1
    this.#label = opts.label ?? 'target'
    this.#width = opts.width
    this.#height = opts.height
    this.#alloc()
  }

  #alloc(): void {
    const size = {
      width: this.#width,
      height: this.#height,
      depthOrArrayLayers: 1,
    }

    // Sampleable single-sample color (always sampleable + render attachment).
    this.#colorTex = this.#device.createTexture({
      label: `${this.#label}:color`,
      size,
      format: this.#format,
      sampleCount: 1,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.RENDER_ATTACHMENT |
        GPUTextureUsage.COPY_SRC,
    })
    if (this.#colorWrap) this.#colorWrap.swap(this.#colorTex)
    else this.#colorWrap = new ViewTexture(this.#colorTex)

    // MSAA color (best-effort): rendered into, then resolved to #colorTex.
    if (this.#samples === 4) {
      this.#msaaColor = this.#device.createTexture({
        label: `${this.#label}:msaa`,
        size,
        format: this.#format,
        sampleCount: 4,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
    }

    // Depth (sampleable so shadow maps can bind it). Sample count must match
    // the color pass sample count.
    if (this.#depthFormat) {
      this.#depthTex = this.#device.createTexture({
        label: `${this.#label}:depth`,
        size,
        format: this.#depthFormat,
        sampleCount: this.#samples,
        usage:
          GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
      })
      if (this.#depthWrap) this.#depthWrap.swap(this.#depthTex)
      else this.#depthWrap = new ViewTexture(this.#depthTex)
    }
  }

  // ---- FrameSurface: build this frame's attachment views ----
  surface(): PassSurface {
    const depthTex = this.#depthTex
    const depthView = depthTex ? () => depthTex.createView() : null
    if (this.#samples === 4 && this.#msaaColor) {
      return {
        colorView: this.#msaaColor.createView(),
        resolveTarget: this.#colorTex.createView(),
        depthView,
      }
    }
    return {
      colorView: this.#colorTex.createView(),
      depthView,
    }
  }

  // ---- Public Target surface ----
  get width(): number {
    return this.#width
  }
  get height(): number {
    return this.#height
  }
  get color(): Texture {
    return this.#colorWrap
  }
  get depth(): Texture | undefined {
    if (this.#depthWrap && this.#samples === 4) {
      throw beamError(
        'target',
        'target.depth is multisampled (samples:4) and cannot be bound as a ' +
          'sampleable texDepth; use samples:1 for sampleable depth (shadow maps)'
      )
    }
    return this.#depthWrap ?? undefined
  }

  clear(color?: Color, depth = 1): this {
    this.#frame.oneShot(() => this.#frame.clear(this, color, depth))
    return this
  }

  draw<
    V extends VertexSchema,
    U extends UniformSchema,
    T extends TextureSchema,
    S extends SamplerSchema,
  >(pipeline: Pipeline<V, U, T, S>, bindings: Bindings<V, U, T, S>): this {
    this.#frame.oneShot(() =>
      this.#frame.draw(this, pipeline as Pipeline, bindings as Bindings)
    )
    return this
  }

  resize(width: number, height: number): void {
    if (width === this.#width && height === this.#height) return
    this.#width = width
    this.#height = height
    this.#msaaColor?.destroy()
    this.#msaaColor = null
    this.#depthTex?.destroy()
    this.#depthTex = null
    // Destroy the old single-sample color last (wrap is swapped in #alloc).
    const oldColor = this.#colorTex
    this.#alloc()
    oldColor.destroy()
  }

  destroy(): void {
    this.#colorTex.destroy()
    this.#msaaColor?.destroy()
    this.#depthTex?.destroy()
  }
}

export function makeTarget(
  device: GPUDevice,
  frame: FrameController,
  opts: TargetOpts,
  defaultFormat: GPUTextureFormat
): Target {
  return new TargetImpl(device, frame, opts, defaultFormat)
}
