// ============================================================================
// Schema engine: schema strings -> GPUVertexFormat / WGSL types / std140 layout.
//
// Resolved contract (DESIGN §3, §4):
//  - Vertex buffers are NON-INTERLEAVED: one GPUBuffer per attribute, ArrayStride =
//    attribute byte size, offset 0, shaderLocation = key order index.
//  - Uniforms pack into ONE std140 UBO: vec3 aligns to 16 (trailing pad),
//    mat2 = 16B (2x vec2 padded to 8 each), mat3 = 48B (3x vec4), mat4 = 64B.
//  - mat3 input is 9 floats, expanded to 12 (3 columns padded vec3->vec4).
// ============================================================================

import type {
  NumType,
  UniformSchema,
  VertexSchema,
  VecType,
  Scalar,
} from './types'

// ---- Component counts -------------------------------------------------------

/** Number of scalar components in a numeric type (matrices count their floats). */
export function numComponents(type: NumType): number {
  switch (type) {
    case 'f32':
    case 'i32':
    case 'u32':
      return 1
    case 'vec2':
      return 2
    case 'vec3':
      return 3
    case 'vec4':
      return 4
    case 'mat2':
      return 4
    case 'mat3':
      return 9
    case 'mat4':
      return 16
  }
}

/** The WGSL type name for a numeric schema type. */
export function wgslType(type: NumType): string {
  switch (type) {
    case 'f32':
      return 'f32'
    case 'i32':
      return 'i32'
    case 'u32':
      return 'u32'
    case 'vec2':
      return 'vec2f'
    case 'vec3':
      return 'vec3f'
    case 'vec4':
      return 'vec4f'
    case 'mat2':
      return 'mat2x2f'
    case 'mat3':
      return 'mat3x3f'
    case 'mat4':
      return 'mat4x4f'
  }
}

// ---- Vertex layout ----------------------------------------------------------

/** GPUVertexFormat for a vertex attribute type (f32/i32/u32 + vec2..4). */
export function vertexFormat(type: VecType | Scalar): GPUVertexFormat {
  switch (type) {
    case 'f32':
      return 'float32'
    case 'i32':
      return 'sint32'
    case 'u32':
      return 'uint32'
    case 'vec2':
      return 'float32x2'
    case 'vec3':
      return 'float32x3'
    case 'vec4':
      return 'float32x4'
  }
}

export interface VertexLayout {
  /** One GPUVertexBufferLayout per attribute (non-interleaved). */
  buffers: GPUVertexBufferLayout[]
  /** Attribute keys in @location order (== key declaration order). */
  order: string[]
}

/**
 * Build the non-interleaved vertex layout: one buffer per attribute, each at
 * its own shaderLocation (= key order), arrayStride = attribute byte size,
 * offset 0. The Nth buffer in `buffers` corresponds to `order[N]`, which is the
 * slot index a draw must bind with setVertexBuffer(N, ...).
 */
export function vertexLayout(vertexSchema: VertexSchema): VertexLayout {
  const order = Object.keys(vertexSchema)
  const buffers: GPUVertexBufferLayout[] = order.map((key, location) => {
    const type = vertexSchema[key] as VecType | Scalar
    const components = numComponents(type)
    const stride = components * 4 // all vertex formats here are 4-byte components
    return {
      arrayStride: stride,
      stepMode: 'vertex',
      attributes: [
        { format: vertexFormat(type), offset: 0, shaderLocation: location },
      ],
    }
  })
  return { buffers, order }
}

// ---- std140 uniform layout --------------------------------------------------

export interface UniformField {
  key: string
  /** Byte offset of this field within the UBO. */
  offset: number
  type: NumType
  /** Scalar component count of the logical value the user supplies. */
  components: number
  /**
   * Whether this field is a mat3 that pads 9 input floats to 12 (3x padded
   * vec3 columns). Other types write their components contiguously.
   */
  pad: boolean
}

export interface UniformLayout {
  /** Total byte size of the UBO (16-aligned struct stride). */
  size: number
  fields: UniformField[]
  /** Lookup by field key (and dotted-path alias) for writeUniform. */
  byKey: Record<string, UniformField>
}

/** std140 base alignment (bytes) for a numeric type. */
function alignOf(type: NumType): number {
  switch (type) {
    case 'f32':
    case 'i32':
    case 'u32':
      return 4
    case 'vec2':
      return 8
    case 'vec3':
    case 'vec4':
      return 16
    case 'mat2':
      return 8 // column alignment of mat2x2<f32> (each column vec2)
    case 'mat3':
      return 16 // columns padded to vec4
    case 'mat4':
      return 16
  }
}

/** std140 byte size occupied by a type. */
function sizeOf(type: NumType): number {
  switch (type) {
    case 'f32':
    case 'i32':
    case 'u32':
      return 4
    case 'vec2':
      return 8
    case 'vec3':
      return 12
    case 'vec4':
      return 16
    case 'mat2':
      return 16 // 2 columns x vec2 padded to 8 each
    case 'mat3':
      return 48 // 3 columns x vec4
    case 'mat4':
      return 64 // 4 columns x vec4
  }
}

function roundUp(n: number, align: number): number {
  return Math.ceil(n / align) * align
}

/**
 * Compute std140 offsets for a flat uniform schema (Record<string, NumType>).
 * Dotted nested keys are addressed by their full path; for the locked core the
 * schema is flat, and a dotted `.set('a.b', v)` resolves against the declared
 * field name 'a.b' (or its trailing segment).
 */
export function uniformLayout(uniformSchema: UniformSchema): UniformLayout {
  const fields: UniformField[] = []
  const byKey: Record<string, UniformField> = {}
  let offset = 0

  for (const key of Object.keys(uniformSchema)) {
    const type = uniformSchema[key] as NumType
    offset = roundUp(offset, alignOf(type))
    const field: UniformField = {
      key,
      offset,
      type,
      components: numComponents(type),
      pad: type === 'mat3',
    }
    fields.push(field)
    byKey[key] = field
    // Also index by trailing dotted segment so dotted keys resolve.
    const dot = key.lastIndexOf('.')
    if (dot >= 0) {
      const tail = key.slice(dot + 1)
      if (!(tail in byKey)) byKey[tail] = field
    }
    offset += sizeOf(type)
  }

  // Struct stride is rounded up to 16 (std140 struct alignment).
  const size = roundUp(offset, 16)
  return { size, fields, byKey }
}

// ---- Writing uniform values -------------------------------------------------

/**
 * Write a single uniform value into a Float32Array view of the UBO at its
 * std140 offset. Handles mat3 expansion (9 -> 12 floats, padding each column).
 * Scalars accept a number; vectors/matrices accept number[] | Float32Array.
 *
 * The view's underlying buffer must be at least `layout.size` bytes. Integer
 * types (i32/u32) are written through an Int32 view sharing the same buffer.
 */
export function writeUniform(
  view: Float32Array,
  layout: UniformLayout,
  key: string,
  value: number | number[] | Float32Array
): void {
  const field = layout.byKey[key]
  if (!field) throw new Error(`unknown uniform field: ${key}`)
  const base = field.offset / 4 // float index

  // Integer scalars route through a shared Int32 view to preserve bit pattern.
  if (field.type === 'i32' || field.type === 'u32') {
    const ints = new Int32Array(view.buffer, view.byteOffset, view.length)
    ints[base] = (value as number) | 0
    return
  }

  if (typeof value === 'number') {
    view[base] = value
    return
  }

  if (field.type === 'mat3') {
    // Expand 9 column-major floats into 3 padded vec4 columns (12 floats).
    for (let col = 0; col < 3; col++) {
      view[base + col * 4 + 0] = value[col * 3 + 0] as number
      view[base + col * 4 + 1] = value[col * 3 + 1] as number
      view[base + col * 4 + 2] = value[col * 3 + 2] as number
      // [col*4 + 3] stays 0 (pad)
    }
    return
  }

  // Contiguous copy for vecN / mat2 / mat4. Caller supplies the right count.
  const n = field.components
  for (let i = 0; i < n; i++) view[base + i] = value[i] as number
}
