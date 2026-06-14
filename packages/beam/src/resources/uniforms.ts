// ============================================================================
// Uniforms<U> — ONE std140-packed UBO per resource. DESIGN §3.2/§3.3.
// .set(key,val) / .set(obj); dotted keys resolve to flat std140 offsets.
// ============================================================================

import type { Uniforms, UniformSchema, UniformState, ValueOf } from '../types'
import { uniformLayout, writeUniform, type UniformLayout } from '../schema'
import { assertUniformSize, beamError } from '../errors'

class UniformsImpl<U extends UniformSchema> implements Uniforms<U> {
  readonly kind = 'uniforms' as const

  #device: GPUDevice
  #label: string
  #layout: UniformLayout
  #buffer: GPUBuffer
  /** CPU-side staging copy; flushed to the GPU on every .set. */
  #cpu: ArrayBuffer
  #view: Float32Array

  constructor(
    device: GPUDevice,
    schema: U,
    state: UniformState<U> | undefined,
    label: string
  ) {
    this.#device = device
    this.#label = label
    this.#layout = uniformLayout(schema)
    assertUniformSize(label, this.#layout.size, schema)

    // std140 struct must be at least 16 bytes; allocate the rounded size.
    const size = Math.max(this.#layout.size, 16)
    this.#cpu = new ArrayBuffer(size)
    this.#view = new Float32Array(this.#cpu)
    this.#buffer = device.createBuffer({
      label,
      size,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    if (state) this.set(state as UniformState<U>)
  }

  set<K extends keyof U>(key: K, value: ValueOf<U[K]>): this
  set(key: string, value: number | number[] | Float32Array): this
  set(state: UniformState<U>): this
  set(
    keyOrState: string | keyof U | UniformState<U>,
    value?: number | number[] | Float32Array
  ): this {
    if (typeof keyOrState === 'string') {
      this.#writeOne(keyOrState, value as number | number[] | Float32Array)
    } else {
      const state = keyOrState as UniformState<U>
      for (const key of Object.keys(state)) {
        const v = state[key as keyof U]
        if (v !== undefined) {
          this.#writeOne(key, v as number | number[] | Float32Array)
        }
      }
    }
    // Flush the whole struct: simplest correct policy, one writeBuffer per set.
    this.#device.queue.writeBuffer(this.#buffer, 0, this.#cpu)
    return this
  }

  #writeOne(key: string, value: number | number[] | Float32Array): void {
    if (!this.#layout.byKey[key]) {
      throw beamError(this.#label, `unknown uniform field "${key}"`)
    }
    writeUniform(this.#view, this.#layout, key, value)
  }

  get buffer(): GPUBuffer {
    return this.#buffer
  }

  destroy(): void {
    this.#buffer.destroy()
  }
}

export function makeUniforms<U extends UniformSchema>(
  device: GPUDevice,
  schema: U,
  state?: UniformState<U>,
  label = 'uniforms'
): Uniforms<U> {
  return new UniformsImpl(device, schema, state, label)
}
