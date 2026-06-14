import { describe, it, expect } from 'vitest'
import {
  numComponents,
  wgslType,
  vertexFormat,
  vertexLayout,
  uniformLayout,
  writeUniform,
} from '../src/schema'

describe('numComponents', () => {
  it('counts scalar / vector / matrix floats', () => {
    expect(numComponents('f32')).toBe(1)
    expect(numComponents('vec2')).toBe(2)
    expect(numComponents('vec3')).toBe(3)
    expect(numComponents('vec4')).toBe(4)
    expect(numComponents('mat2')).toBe(4)
    expect(numComponents('mat3')).toBe(9)
    expect(numComponents('mat4')).toBe(16)
  })
})

describe('wgslType / vertexFormat', () => {
  it('maps schema types to WGSL types', () => {
    expect(wgslType('vec3')).toBe('vec3f')
    expect(wgslType('mat4')).toBe('mat4x4f')
    expect(wgslType('u32')).toBe('u32')
  })
  it('maps vertex attribute types to GPUVertexFormat', () => {
    expect(vertexFormat('f32')).toBe('float32')
    expect(vertexFormat('vec2')).toBe('float32x2')
    expect(vertexFormat('vec3')).toBe('float32x3')
    expect(vertexFormat('vec4')).toBe('float32x4')
    expect(vertexFormat('i32')).toBe('sint32')
    expect(vertexFormat('u32')).toBe('uint32')
  })
})

describe('vertexLayout (non-interleaved)', () => {
  it('emits one buffer per attribute at its own shaderLocation', () => {
    const { buffers, order } = vertexLayout({ position: 'vec3', color: 'vec4' })
    expect(order).toEqual(['position', 'color'])
    expect(buffers).toHaveLength(2)

    expect(buffers[0]!.arrayStride).toBe(12) // vec3 = 3 * 4
    expect(buffers[0]!.stepMode).toBe('vertex')
    const a0 = [...buffers[0]!.attributes][0]
    expect(a0).toMatchObject({
      format: 'float32x3',
      offset: 0,
      shaderLocation: 0,
    })

    expect(buffers[1]!.arrayStride).toBe(16) // vec4 = 4 * 4
    const a1 = [...buffers[1]!.attributes][0]
    expect(a1).toMatchObject({
      format: 'float32x4',
      offset: 0,
      shaderLocation: 1,
    })
  })
})

describe('uniformLayout (WGSL memory layout)', () => {
  it('packs scalars/vectors with correct offsets and 16-byte struct stride', () => {
    const { size, byKey } = uniformLayout({
      modelMat: 'mat4',
      tint: 'vec4',
      t: 'f32',
    })
    expect(byKey.modelMat!.offset).toBe(0)
    expect(byKey.tint!.offset).toBe(64)
    expect(byKey.t!.offset).toBe(80)
    expect(size).toBe(96) // roundUp(84, 16)
  })

  it('fills the vec3 trailing pad with a following scalar', () => {
    const { size, byKey } = uniformLayout({ dir: 'vec3', strength: 'f32' })
    expect(byKey.dir!.offset).toBe(0)
    expect(byKey.strength!.offset).toBe(12) // tucks into vec3 pad
    expect(size).toBe(16)
  })

  it('aligns vec3 to 16 even when alone', () => {
    const { size, byKey } = uniformLayout({ a: 'f32', b: 'vec3' })
    expect(byKey.a!.offset).toBe(0)
    expect(byKey.b!.offset).toBe(16) // vec3 aligns to 16, not 4
    expect(size).toBe(32)
  })

  it('sizes mat3 as 48 bytes (3 x padded vec4 columns)', () => {
    const { size, byKey } = uniformLayout({ n: 'mat3' })
    expect(byKey.n!.offset).toBe(0)
    expect(size).toBe(48)
  })

  it('sizes mat2 as 16 bytes (WGSL layout)', () => {
    const { size } = uniformLayout({ m: 'mat2' })
    expect(size).toBe(16)
  })

  it('resolves dotted-path aliases to the trailing segment', () => {
    const { byKey } = uniformLayout({ 'light.dir': 'vec3' })
    expect(byKey['light.dir']!.offset).toBe(0)
    expect(byKey.dir!.offset).toBe(0)
  })
})

describe('writeUniform', () => {
  const buf = (layout: ReturnType<typeof uniformLayout>) =>
    new Float32Array(layout.size / 4)

  it('expands mat3 (9 floats) into 3 padded vec4 columns (12 floats)', () => {
    const layout = uniformLayout({ n: 'mat3' })
    const view = buf(layout)
    writeUniform(view, layout, 'n', [1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect([...view]).toEqual([1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0])
  })

  it('writes a vec3 contiguously at its offset', () => {
    const layout = uniformLayout({ a: 'f32', dir: 'vec3' })
    const view = buf(layout)
    writeUniform(view, layout, 'dir', [7, 8, 9])
    expect(view[4]).toBe(7) // offset 16 -> float index 4
    expect(view[5]).toBe(8)
    expect(view[6]).toBe(9)
  })

  it('writes a scalar', () => {
    const layout = uniformLayout({ t: 'f32' })
    const view = buf(layout)
    writeUniform(view, layout, 't', 0.5)
    expect(view[0]).toBe(0.5)
  })

  it('preserves the bit pattern of i32 values', () => {
    const layout = uniformLayout({ flag: 'i32' })
    const view = buf(layout)
    writeUniform(view, layout, 'flag', 1)
    const ints = new Int32Array(view.buffer)
    expect(ints[0]).toBe(1)
    // As a float reinterpretation, 1-as-int is a tiny denormal, not 1.0
    expect(view[0]).not.toBe(1)
  })

  it('throws on an unknown field', () => {
    const layout = uniformLayout({ t: 'f32' })
    expect(() => writeUniform(buf(layout), layout, 'nope', 1)).toThrow()
  })
})
