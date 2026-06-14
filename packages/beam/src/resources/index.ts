// ============================================================================
// Index — index buffer, auto-selects uint16/uint32 by max index. DESIGN §2.3.
// ============================================================================

import type { Index, IndexState } from '../types'
import { beamError } from '../errors'

class IndexImpl implements Index {
  readonly kind = 'index' as const

  #device: GPUDevice
  #label: string
  #buffer: GPUBuffer | null = null
  #count = 0
  #offset = 0
  #format: GPUIndexFormat = 'uint16'

  constructor(device: GPUDevice, state: IndexState, label: string) {
    this.#device = device
    this.#label = label
    this.set(state)
  }

  set(state: IndexState): this {
    const { array, offset = 0 } = state

    // Pick width: explicit typed array wins, else by max index value.
    let data: Uint16Array | Uint32Array
    if (array instanceof Uint32Array) {
      data = array
      this.#format = 'uint32'
    } else if (array instanceof Uint16Array) {
      data = array
      this.#format = 'uint16'
    } else {
      let max = 0
      for (let i = 0; i < array.length; i++) {
        const v = array[i] as number
        if (v > max) max = v
      }
      if (max > 0xffff) {
        data = new Uint32Array(array)
        this.#format = 'uint32'
      } else {
        data = new Uint16Array(array)
        this.#format = 'uint16'
      }
    }

    this.#count = state.count ?? data.length
    this.#offset = offset

    // GPUBuffer size must be a multiple of 4; pad uint16 odd-length buffers.
    const byteLength = (data.byteLength + 3) & ~3
    const existing = this.#buffer
    if (existing && existing.size === byteLength) {
      // writeBuffer's write size must be a multiple of 4: pad an odd-length
      // uint16 source up to the (already 4-aligned) buffer size.
      if (data.byteLength === byteLength) {
        this.#device.queue.writeBuffer(existing, 0, data as BufferSource)
      } else {
        const padded = new Uint8Array(byteLength)
        padded.set(
          new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
        )
        this.#device.queue.writeBuffer(existing, 0, padded)
      }
      return this
    }
    if (existing) existing.destroy()
    const buffer = this.#device.createBuffer({
      label: this.#label,
      size: byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })
    if (this.#format === 'uint32') {
      new Uint32Array(buffer.getMappedRange()).set(data as Uint32Array)
    } else {
      new Uint16Array(buffer.getMappedRange(), 0, data.length).set(
        data as Uint16Array
      )
    }
    buffer.unmap()
    this.#buffer = buffer
    return this
  }

  get count(): number {
    return this.#count
  }
  get offset(): number {
    return this.#offset
  }
  get format(): GPUIndexFormat {
    return this.#format
  }
  get buffer(): GPUBuffer {
    if (!this.#buffer) throw beamError(this.#label, 'index buffer not set')
    return this.#buffer
  }

  destroy(): void {
    this.#buffer?.destroy()
    this.#buffer = null
  }
}

export function makeIndex(
  device: GPUDevice,
  state: IndexState,
  label = 'index'
): Index {
  return new IndexImpl(device, state, label)
}
