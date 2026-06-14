// ============================================================================
// Pass — a thin wrapper over GPURenderPassEncoder. DESIGN §1 (render pass stays
// a first-class concept) + §3.6 (loadOp logic).
//
// A Pass is begun against a "surface" (the swapchain or a Target's attachments)
// using a given GPUCommandEncoder. The first time a surface is drawn/cleared in
// a frame its pass uses loadOp:'clear' to [0,0,0,1] (or an explicit clear()
// color); subsequent draws to the SAME open pass load (accumulate). clear()
// called while a pass is open re-begins it with a clear loadOp.
//
// draw() resolves the keyed Bindings (building/caching bind groups) then records
// setPipeline / setVertexBuffer(s) / setBindGroup / setIndexBuffer / draw(Indexed).
// ============================================================================

import type { Bindings, Pass, Pipeline } from './types'
import { resolveBindings } from './bindings'
import { beamError } from './errors'

export type Color = [number, number, number, number]

const BLACK: Color = [0, 0, 0, 1]

/**
 * The concrete render surface a Pass records into. Both the screen (swapchain)
 * and a Target produce one of these per frame; the Pass turns it into a
 * GPURenderPassEncoder with the right load/store ops.
 *
 *  - `colorView`     is the attachment written by the fragment shader. With MSAA
 *    it is the multisample texture; `resolveTarget` is the single-sample target.
 *  - `resolveTarget` is set only for samples:4 (resolve destination).
 *  - `depthView`     is the depth attachment (must match the pipeline's depth
 *    format + sample count); null when the surface has no depth.
 */
export interface PassSurface {
  colorView: GPUTextureView
  resolveTarget?: GPUTextureView
  depthView: GPUTextureView | null
}

/** Pending load state, set by clear() before/while a pass is open. */
interface LoadState {
  /** null => load (accumulate); a color => clear to that color. */
  color: Color | null
  /** Depth clear value when clearing; default 1. */
  depth: number
}

class PassImpl implements Pass {
  readonly encoder: GPUCommandEncoder

  #device: GPUDevice
  #surface: PassSurface
  #gpu: GPURenderPassEncoder | null = null
  #ended = false
  #ownsEncoder: boolean

  // Next-pass load state. Starts as a clear-to-black (DESIGN §3.6: a surface
  // drawn without an explicit clear() still clears on its first pass).
  #load: LoadState = { color: BLACK, depth: 1 }

  constructor(
    device: GPUDevice,
    encoder: GPUCommandEncoder,
    surface: PassSurface,
    ownsEncoder: boolean
  ) {
    this.#device = device
    this.encoder = encoder
    this.#surface = surface
    this.#ownsEncoder = ownsEncoder
  }

  get gpu(): GPURenderPassEncoder {
    return this.#open()
  }

  /** Begin the GPU render pass lazily with the current load state. */
  #open(): GPURenderPassEncoder {
    if (this.#ended) throw beamError('pass', 'pass already ended')
    if (this.#gpu) return this.#gpu

    const s = this.#surface
    const clear = this.#load.color
    const colorAttachment: GPURenderPassColorAttachment = {
      view: s.colorView,
      loadOp: clear ? 'clear' : 'load',
      storeOp: 'store',
      ...(clear
        ? { clearValue: { r: clear[0], g: clear[1], b: clear[2], a: clear[3] } }
        : {}),
      ...(s.resolveTarget ? { resolveTarget: s.resolveTarget } : {}),
    }

    const desc: GPURenderPassDescriptor = {
      colorAttachments: [colorAttachment],
    }
    if (s.depthView) {
      desc.depthStencilAttachment = {
        view: s.depthView,
        depthLoadOp: clear ? 'clear' : 'load',
        depthStoreOp: 'store',
        ...(clear ? { depthClearValue: this.#load.depth } : {}),
      }
    }

    this.#gpu = this.encoder.beginRenderPass(desc)
    // After opening, subsequent implicit draws accumulate (load).
    this.#load = { color: null, depth: this.#load.depth }
    return this.#gpu
  }

  clear(color: Color = BLACK, depth = 1): this {
    if (this.#ended) throw beamError('pass', 'pass already ended')
    if (this.#gpu) {
      // A pass is already open: end it and re-begin with a clear loadOp so the
      // clear actually takes effect (you cannot change loadOp mid-pass).
      this.#gpu.end()
      this.#gpu = null
    }
    this.#load = { color, depth }
    return this
  }

  draw(pipeline: Pipeline, bindings: Bindings): this {
    const pass = this.#open()
    const r = resolveBindings(this.#device, pipeline, bindings)

    pass.setPipeline(pipeline.gpu)
    for (const g of r.groups) pass.setBindGroup(g.index, g.gpu)
    for (let slot = 0; slot < r.vertexBuffers.length; slot++) {
      pass.setVertexBuffer(slot, r.vertexBuffers[slot] as GPUBuffer)
    }

    if (r.index) {
      pass.setIndexBuffer(r.index.buffer, r.index.format)
      pass.drawIndexed(r.index.count, r.instanceCount, r.index.offset)
    } else {
      pass.draw(r.vertexCount, r.instanceCount)
    }
    return this
  }

  viewport(x: number, y: number, w: number, h: number): this {
    this.#open().setViewport(x, y, w, h, 0, 1)
    return this
  }

  scissor(x: number, y: number, w: number, h: number): this {
    this.#open().setScissorRect(x, y, w, h)
    return this
  }

  end(): this {
    if (this.#ended) return this
    // Force the pass open even if nothing was drawn, so a bare clear() still
    // produces a cleared surface.
    this.#open().end()
    this.#gpu = null
    this.#ended = true
    return this
  }

  submit(): void {
    this.end()
    if (this.#ownsEncoder) {
      this.#device.queue.submit([this.encoder.finish()])
    }
  }
}

/** Create a Pass over `surface` recording into `encoder`. */
export function makePass(
  device: GPUDevice,
  encoder: GPUCommandEncoder,
  surface: PassSurface,
  ownsEncoder = false
): PassImpl {
  return new PassImpl(device, encoder, surface, ownsEncoder)
}

export type { PassImpl }
