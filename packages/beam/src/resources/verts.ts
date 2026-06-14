// ============================================================================
// Verts<V> — one GPUBuffer per attribute (non-interleaved). DESIGN §3.1.
// ============================================================================

import type { Verts, VertexSchema, VertsState } from '../types'
import { numComponents } from '../schema'
import { beamError } from '../errors'

class VertsImpl<V extends VertexSchema> implements Verts<V> {
  readonly kind = 'verts' as const
  readonly buffers: Record<keyof V & string, GPUBuffer>

  #device: GPUDevice
  #schema: V
  #label: string
  /** Per-attribute element count (array length / components). */
  #counts: Record<string, number> = {}

  constructor(
    device: GPUDevice,
    schema: V,
    state: Partial<VertsState<V>> | undefined,
    label: string
  ) {
    this.#device = device
    this.#schema = schema
    this.#label = label
    this.buffers = {} as Record<keyof V & string, GPUBuffer>
    if (state) this.set(state)
  }

  set<K extends keyof V>(key: K, value: number[] | Float32Array): this
  set(state: Partial<VertsState<V>>): this
  set(
    keyOrState: keyof V | Partial<VertsState<V>>,
    value?: number[] | Float32Array
  ): this {
    if (typeof keyOrState === 'string') {
      this.#setOne(keyOrState, value as number[] | Float32Array)
    } else {
      const state = keyOrState as Partial<VertsState<V>>
      for (const key of Object.keys(state)) {
        // Ignore keys not in the schema, so `beam.verts(schema, mesh.vertex)`
        // works when the geometry carries extra attributes (e.g. texCoord).
        if (!this.#schema[key as keyof V]) continue
        const v = state[key as keyof V]
        if (v) this.#setOne(key, v)
      }
    }
    return this
  }

  #setOne(key: string, value: number[] | Float32Array): void {
    const type = this.#schema[key]
    if (!type) throw beamError(this.#label, `no vertex attribute "${key}"`)
    const data: Float32Array<ArrayBuffer> =
      value instanceof Float32Array
        ? (value as Float32Array<ArrayBuffer>)
        : new Float32Array(value)
    const components = numComponents(type)
    this.#counts[key] = data.length / components

    const existing = this.buffers[key as keyof V & string] as
      | GPUBuffer
      | undefined
    // Reuse buffer if size matches (mutation keeps identity -> bind cache hit).
    if (existing && existing.size === data.byteLength) {
      this.#device.queue.writeBuffer(existing, 0, data)
      return
    }
    if (existing) existing.destroy()
    const buffer = this.#device.createBuffer({
      label: `${this.#label}:${key}`,
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    })
    new Float32Array(buffer.getMappedRange()).set(data)
    buffer.unmap()
    this.buffers[key as keyof V & string] = buffer
  }

  /** Vertex count = the minimum element count across attributes. */
  get count(): number {
    const keys = Object.keys(this.#counts)
    if (keys.length === 0) return 0
    let min = Infinity
    for (const k of keys) min = Math.min(min, this.#counts[k] as number)
    return min === Infinity ? 0 : min
  }

  destroy(): void {
    for (const key of Object.keys(this.buffers)) {
      this.buffers[key as keyof V & string].destroy()
    }
  }
}

export function makeVerts<V extends VertexSchema>(
  device: GPUDevice,
  schema: V,
  state?: Partial<VertsState<V>>,
  label = 'verts'
): Verts<V> {
  return new VertsImpl(device, schema, state, label)
}
