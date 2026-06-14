// ============================================================================
// Beam — the device. DESIGN §2.1. Acquires adapter + device, configures the
// canvas context, and exposes the terse factory + draw verbs. Implements the
// reference-api Beam class EXACTLY.
//
// frame()/loop() drive a FrameController that owns the per-frame command
// encoder. clear()/draw() record into the current frame; called outside a
// frame they wrap themselves in a one-shot frame for convenience (DESIGN: the
// everyday pattern uses frame()/loop()).
// ============================================================================

import type {
  Bindings,
  BeamConfig,
  BindEntries,
  BindGroup,
  BindLayout,
  CubeFaces,
  IndexState,
  Index,
  PassOpts,
  Pipeline,
  PipelineTemplate,
  Sampler,
  SamplerOpts,
  SamplerSchema,
  Target,
  TargetOpts,
  Texture,
  TextureOpts,
  TextureSchema,
  TextureSource,
  UniformSchema,
  UniformState,
  Uniforms,
  VertexSchema,
  Verts,
  VertsState,
  Pass,
} from './types'
import { makePipeline } from './pipeline'
import { makeBind } from './bind'
import { makeVerts } from './resources/verts'
import { makeIndex } from './resources/index'
import { makeUniforms } from './resources/uniforms'
import { makeTexture, makeCube } from './resources/texture'
import { makeSampler } from './resources/sampler'
import { makePass, type Color, type PassSurface } from './pass'
import { FrameController, type ScreenSurfaceProvider } from './frame'
import { makeTarget } from './target'
import { beamError } from './errors'

// The screen depth attachment must match pipelines' default depth format.
const SCREEN_DEPTH_FORMAT: GPUTextureFormat = 'depth24plus'

export class Beam implements ScreenSurfaceProvider {
  readonly device: GPUDevice
  readonly adapter: GPUAdapter
  readonly ctx: GPUCanvasContext
  readonly format: GPUTextureFormat
  readonly canvas: HTMLCanvasElement

  #hidpi: boolean
  #samples: 1 | 4 = 1

  #frame: FrameController
  #screen: ReturnType<FrameController['screen']>

  // Lazily (re)allocated screen depth texture, matched to the canvas size.
  #depthTex: GPUTexture | null = null
  // Lazily (re)allocated screen MSAA color (samples:4 best-effort).
  #msaaColor: GPUTexture | null = null

  private constructor(
    adapter: GPUAdapter,
    device: GPUDevice,
    canvas: HTMLCanvasElement,
    ctx: GPUCanvasContext,
    format: GPUTextureFormat,
    config: BeamConfig
  ) {
    this.adapter = adapter
    this.device = device
    this.canvas = canvas
    this.ctx = ctx
    this.format = format
    this.#hidpi = config.hidpi ?? false

    this.#frame = new FrameController(device, this)
    this.#screen = this.#frame.screen()

    if (this.#hidpi) this.resize()
  }

  // ---- Async init ----------------------------------------------------------

  static async gpu(
    canvas: HTMLCanvasElement,
    config: BeamConfig = {}
  ): Promise<Beam> {
    if (!navigator.gpu) throw beamError('gpu', 'WebGPU not available')

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: config.power,
    })
    if (!adapter) throw beamError('gpu', 'no GPU adapter')

    const device =
      config.device ??
      (await adapter.requestDevice({
        requiredFeatures: config.features,
        requiredLimits: config.limits,
      }))

    const ctx = canvas.getContext('webgpu')
    if (!ctx) throw beamError('gpu', 'could not get a webgpu context')

    const format = config.format ?? navigator.gpu.getPreferredCanvasFormat()
    const alpha = config.alpha ?? 'opaque'
    ctx.configure({ device, format, alphaMode: alpha })

    return new Beam(adapter, device, canvas, ctx, format, config)
  }

  /** Alias for {@link Beam.gpu}. */
  static create(
    canvas: HTMLCanvasElement,
    config: BeamConfig = {}
  ): Promise<Beam> {
    return Beam.gpu(canvas, config)
  }

  // ---- Screen surface provider (per-frame attachments) ---------------------

  screenSurface(): PassSurface {
    const colorView = this.ctx.getCurrentTexture().createView()
    // Depth is offered lazily: the screen depth texture is only allocated when
    // a draw with a depth pipeline actually attaches it (see Pass). So a
    // `depth: true` pipeline drawn to the screen just works, with no config and
    // no cost for 2D apps. `config.depth` is kept as a no-op for back-compat.
    const depthView = () => this.#ensureDepth().createView()

    if (this.#samples === 4) {
      return {
        colorView: this.#ensureMsaa().createView(),
        resolveTarget: colorView,
        depthView,
      }
    }
    return { colorView, depthView }
  }

  #ensureDepth(): GPUTexture {
    const w = this.canvas.width
    const h = this.canvas.height
    const t = this.#depthTex
    if (
      t &&
      t.width === w &&
      t.height === h &&
      t.sampleCount === this.#samples
    ) {
      return t
    }
    t?.destroy()
    const tex = this.device.createTexture({
      label: 'screen:depth',
      size: { width: w, height: h },
      format: SCREEN_DEPTH_FORMAT,
      sampleCount: this.#samples,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
    this.#depthTex = tex
    return tex
  }

  #ensureMsaa(): GPUTexture {
    const w = this.canvas.width
    const h = this.canvas.height
    const t = this.#msaaColor
    if (t && t.width === w && t.height === h) return t
    t?.destroy()
    const tex = this.device.createTexture({
      label: 'screen:msaa',
      size: { width: w, height: h },
      format: this.format,
      sampleCount: 4,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
    this.#msaaColor = tex
    return tex
  }

  // ---- Pipeline + resource factories ---------------------------------------

  pipeline<
    V extends VertexSchema,
    U extends UniformSchema = {},
    T extends TextureSchema = {},
    S extends SamplerSchema = {},
  >(template: PipelineTemplate<V, U, T, S>): Pipeline<V, U, T, S> {
    // Track the screen sample count so screen attachments match the pipeline.
    if (template.samples === 4) this.#samples = 4
    return makePipeline(this.device, this.format, template)
  }

  verts<V extends VertexSchema>(
    schema: V,
    state?: Partial<VertsState<V>>
  ): Verts<V> {
    return makeVerts(this.device, schema, state)
  }

  index(state: IndexState): Index {
    return makeIndex(this.device, state)
  }

  uniforms<U extends UniformSchema>(
    schema: U,
    state?: UniformState<U>
  ): Uniforms<U> {
    return makeUniforms(this.device, schema, state)
  }

  texture(source?: TextureSource, opts?: TextureOpts): Texture {
    return makeTexture(this.device, source, opts)
  }

  cube(faces?: CubeFaces, opts?: TextureOpts): Texture {
    return makeCube(this.device, faces, opts)
  }

  sampler(opts?: SamplerOpts): Sampler {
    return makeSampler(this.device, opts)
  }

  bind(layout: BindLayout, entries: BindEntries): BindGroup {
    return makeBind(this.device, layout, entries)
  }

  target(opts: TargetOpts): Target {
    if (opts.samples === 4) this.#samples = 4
    return makeTarget(this.device, this.#frame, opts, this.format)
  }

  // ---- Draw verbs ----------------------------------------------------------

  clear(color?: Color, depth = 1): this {
    this.#frame.oneShot(() => this.#frame.clear(this.#screen, color, depth))
    return this
  }

  draw<
    V extends VertexSchema,
    U extends UniformSchema = {},
    T extends TextureSchema = {},
    S extends SamplerSchema = {},
  >(pipeline: Pipeline<V, U, T, S>, bindings: Bindings<V, U, T, S>): this {
    this.#frame.oneShot(() =>
      this.#frame.draw(this.#screen, pipeline as Pipeline, bindings as Bindings)
    )
    return this
  }

  // ---- Power path: explicit Pass -------------------------------------------

  /**
   * Open a standalone Pass (power path). Without a frame open it owns its own
   * encoder and must be .submit()ted; the default surface is the screen, or a
   * target's attachments when `opts.target` is given.
   */
  pass(opts: PassOpts = {}): Pass {
    const encoder =
      opts.encoder ??
      this.#frame.encoder ??
      this.device.createCommandEncoder({ label: 'pass' })
    const ownsEncoder = !opts.encoder && !this.#frame.encoder
    // Reusing the frame's encoder: end its currently-open render pass first —
    // WebGPU forbids two render passes encoding on one encoder at once.
    if (!opts.encoder && this.#frame.encoder) this.#frame.flushPass()

    let surface: PassSurface
    if (opts.target) {
      // Reuse the Target's surface (FrameSurface is structurally compatible).
      surface = (opts.target as unknown as { surface(): PassSurface }).surface()
    } else {
      surface = this.screenSurface()
    }

    const p = makePass(this.device, encoder, surface, ownsEncoder)
    if (opts.clear !== undefined) {
      p.clear(opts.clear ?? undefined, opts.clearDepth ?? 1)
    }
    return p
  }

  // ---- Frame lifecycle -----------------------------------------------------

  frame(cb: (t: number) => void): void {
    this.#frame.frame(cb)
  }

  loop(cb: (t: number, dt: number) => void): () => void {
    return this.#frame.loop(cb)
  }

  // ---- Sizing + teardown ---------------------------------------------------

  resize(width?: number, height?: number): void {
    const ratio = this.#hidpi ? globalThis.devicePixelRatio || 1 : 1
    if (width !== undefined && height !== undefined) {
      this.canvas.width = Math.round(width * ratio)
      this.canvas.height = Math.round(height * ratio)
    } else if (this.#hidpi) {
      // Scale the current CSS size by devicePixelRatio.
      this.canvas.width = Math.round(this.canvas.clientWidth * ratio)
      this.canvas.height = Math.round(this.canvas.clientHeight * ratio)
    }
    // Screen depth / MSAA textures are re-checked (and reallocated) per-frame
    // against the canvas size, so nothing else to do here.
  }

  destroy(): void {
    this.#depthTex?.destroy()
    this.#msaaColor?.destroy()
    this.ctx.unconfigure()
    this.device.destroy()
  }
}

export default Beam
