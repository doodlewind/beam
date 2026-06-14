// ============================================================================
// frame.ts — the per-frame encoder lifecycle. DESIGN §1 ("a frame is a
// function"): frame() opens one GPUCommandEncoder, runs the user callback (which
// records screen draws + target draws), ends the open pass, and submits.
//
// Within a frame at most ONE render pass is open at a time. Drawing to a
// different surface (screen <-> target, or target <-> other target) ends the
// previous pass first, since WebGPU forbids nesting render passes on one
// encoder. Consecutive draws to the same surface reuse the same open pass
// (DESIGN §3.6: subsequent draws to an open pass load/accumulate).
//
// The screen surface's color view is fetched per-frame from
// ctx.getCurrentTexture().createView() — it is only valid for that frame.
// ============================================================================

import type { Bindings, Pipeline } from './types'
import { makePass, type Color, type PassImpl, type PassSurface } from './pass'
import { beamError } from './errors'

/** Supplies the screen's per-frame attachments (swapchain + optional depth). */
export interface ScreenSurfaceProvider {
  /** Build the screen PassSurface for the CURRENT frame (fresh swapchain view). */
  screenSurface(): PassSurface
}

/**
 * A surface participant (the screen or a Target). The frame controller keys its
 * open pass on the participant identity so it knows when to switch passes.
 */
export interface FrameSurface {
  /** Stable identity used to detect surface switches. */
  readonly id: object
  /** Build the PassSurface for the current frame. */
  surface(): PassSurface
}

class FrameController {
  #device: GPUDevice
  #screen: ScreenSurfaceProvider

  // Per-frame state. encoder/pass are non-null only between begin() and end().
  #encoder: GPUCommandEncoder | null = null
  #pass: PassImpl | null = null
  #activeId: object | null = null

  // A stable identity for the screen surface.
  readonly screenId: object = { screen: true }

  constructor(device: GPUDevice, screen: ScreenSurfaceProvider) {
    this.#device = device
    this.#screen = screen
  }

  get inFrame(): boolean {
    return this.#encoder !== null
  }

  /** Begin a frame: open the command encoder. */
  begin(): void {
    if (this.#encoder) throw beamError('frame', 'frame already open')
    this.#encoder = this.#device.createCommandEncoder({ label: 'frame' })
  }

  /** End the currently-open render pass (if any) but keep the encoder open. */
  flushPass(): void {
    if (this.#pass) {
      this.#pass.end()
      this.#pass = null
    }
    this.#activeId = null
  }

  /** End the open pass (if any), finish the encoder, and submit. */
  end(): void {
    const encoder = this.#encoder
    if (!encoder) return
    if (this.#pass) {
      this.#pass.end()
      this.#pass = null
    }
    this.#activeId = null
    this.#device.queue.submit([encoder.finish()])
    this.#encoder = null
  }

  /**
   * Get the open pass for `s`, switching surfaces if needed. Ends the previous
   * pass when the active surface changes (WebGPU: one pass at a time).
   */
  #passFor(s: FrameSurface): PassImpl {
    const encoder = this.#encoder
    if (!encoder) throw beamError('frame', 'draw/clear outside a frame')

    if (this.#activeId !== s.id) {
      // Switching surfaces: end the previous pass.
      if (this.#pass) {
        this.#pass.end()
        this.#pass = null
      }
      this.#pass = makePass(this.#device, encoder, s.surface())
      this.#activeId = s.id
    }
    return this.#pass as PassImpl
  }

  /**
   * Record a clear for `s`. Eagerly makes `s` the active surface and sets its
   * next-pass loadOp so a bare clear() with no following draw still flushes a
   * cleared surface at end(); a following draw to the same surface accumulates.
   */
  clear(s: FrameSurface, color?: Color, depth = 1): void {
    this.#passFor(s).clear(color, depth)
  }

  /** Record a draw to `s`. */
  draw(s: FrameSurface, pipeline: Pipeline, bindings: Bindings): void {
    this.#passFor(s).draw(pipeline, bindings)
  }

  /** Build the screen FrameSurface bound to this controller's provider. */
  screen(): FrameSurface {
    return { id: this.screenId, surface: () => this.#screen.screenSurface() }
  }

  /**
   * Run `cb` inside a self-contained frame. If a frame is already open (e.g.
   * a one-shot clear/draw opened one), reuse it rather than nesting.
   */
  frame(cb: (t: number) => void, t = performance.now()): void {
    // Flush any pending deferred one-shot so this becomes a fresh, owned frame.
    if (this.#deferredOpen) this.#flushDeferred()
    if (this.#encoder) {
      // Already in an explicit frame (nested call); just run.
      cb(t)
      return
    }
    this.begin()
    try {
      cb(t)
    } finally {
      this.end()
    }
  }

  /** rAF loop passing (t, dt) in ms; returns a stop() function. */
  loop(cb: (t: number, dt: number) => void): () => void {
    let raf = 0
    let last = performance.now()
    let stopped = false
    const tick = (now: number): void => {
      if (stopped) return
      const dt = now - last
      last = now
      this.frame((t) => cb(t, dt), now)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
    }
  }

  // True while a deferred one-shot frame is open awaiting its microtask flush.
  #deferredOpen = false

  /** Immediately submit a pending deferred one-shot frame. */
  #flushDeferred(): void {
    this.#deferredOpen = false
    this.end()
  }

  /**
   * Convenience for clear/draw called OUTSIDE a frame (DESIGN: the everyday
   * pattern wraps in frame()/loop(), but a bare beam.clear()/draw() should still
   * work). When no frame is open, the FIRST bare call opens an encoder and
   * schedules its submit on a microtask; synchronously-chained calls in the same
   * tick (e.g. `beam.clear().draw(...)`) reuse that encoder so they land in one
   * frame instead of clobbering each other on the same swapchain texture.
   */
  oneShot(body: () => void): void {
    if (this.#encoder) {
      body()
      return
    }
    this.begin()
    this.#deferredOpen = true
    queueMicrotask(() => {
      if (this.#deferredOpen) {
        this.#deferredOpen = false
        this.end()
      }
    })
    body()
  }

  /** The current frame's encoder (for Target passes); null outside a frame. */
  get encoder(): GPUCommandEncoder | null {
    return this.#encoder
  }
}

export { FrameController }
