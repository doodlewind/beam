// 4x4 matrix helpers (inlined from gl-matrix).
//
// IMPORTANT: `perspective` and `ortho` here use the zero-to-one (ZO) depth
// convention — clip-space Z maps to [0, 1], which is what WebGPU expects. Do
// not use a [-1, 1] depth projection.
export type Mat4 = number[] | Float32Array
export type Vec3 = number[] | Float32Array

const EPSILON = 0.000001

export const create = (): Float32Array => {
  const out = new Float32Array(16)
  out[0] = 1
  out[5] = 1
  out[10] = 1
  out[15] = 1
  return out
}

export const identity = (out: Mat4): Mat4 => {
  out[0] = 1
  out[1] = 0
  out[2] = 0
  out[3] = 0
  out[4] = 0
  out[5] = 1
  out[6] = 0
  out[7] = 0
  out[8] = 0
  out[9] = 0
  out[10] = 1
  out[11] = 0
  out[12] = 0
  out[13] = 0
  out[14] = 0
  out[15] = 1
  return out
}

// WebGPU perspective: depth range [0, 1].
export const perspective = (
  out: Mat4,
  fovy: number,
  aspect: number,
  near: number,
  far?: number
): Mat4 => {
  const f = 1.0 / Math.tan(fovy / 2)
  out[0] = f / aspect
  out[1] = 0
  out[2] = 0
  out[3] = 0
  out[4] = 0
  out[5] = f
  out[6] = 0
  out[7] = 0
  out[8] = 0
  out[9] = 0
  out[11] = -1
  out[12] = 0
  out[13] = 0
  out[15] = 0
  if (far != null && far !== Infinity) {
    const nf = 1 / (near - far)
    out[10] = far * nf
    out[14] = far * near * nf
  } else {
    out[10] = -1
    out[14] = -near
  }
  return out
}

// WebGPU orthographic: depth range [0, 1].
export const ortho = (
  out: Mat4,
  left: number,
  right: number,
  bottom: number,
  top: number,
  near: number,
  far: number
): Mat4 => {
  const lr = 1 / (left - right)
  const bt = 1 / (bottom - top)
  const nf = 1 / (near - far)
  out[0] = -2 * lr
  out[1] = 0
  out[2] = 0
  out[3] = 0
  out[4] = 0
  out[5] = -2 * bt
  out[6] = 0
  out[7] = 0
  out[8] = 0
  out[9] = 0
  out[10] = nf
  out[11] = 0
  out[12] = (left + right) * lr
  out[13] = (top + bottom) * bt
  out[14] = near * nf
  out[15] = 1
  return out
}

export const lookAt = (out: Mat4, eye: Vec3, center: Vec3, up: Vec3): Mat4 => {
  const eyex = eye[0],
    eyey = eye[1],
    eyez = eye[2]
  const upx = up[0],
    upy = up[1],
    upz = up[2]
  const centerx = center[0],
    centery = center[1],
    centerz = center[2]

  if (
    Math.abs(eyex - centerx) < EPSILON &&
    Math.abs(eyey - centery) < EPSILON &&
    Math.abs(eyez - centerz) < EPSILON
  ) {
    return identity(out)
  }

  let z0 = eyex - centerx,
    z1 = eyey - centery,
    z2 = eyez - centerz
  let len = 1 / Math.hypot(z0, z1, z2)
  z0 *= len
  z1 *= len
  z2 *= len

  let x0 = upy * z2 - upz * z1
  let x1 = upz * z0 - upx * z2
  let x2 = upx * z1 - upy * z0
  len = Math.hypot(x0, x1, x2)
  if (!len) {
    x0 = 0
    x1 = 0
    x2 = 0
  } else {
    len = 1 / len
    x0 *= len
    x1 *= len
    x2 *= len
  }

  let y0 = z1 * x2 - z2 * x1
  let y1 = z2 * x0 - z0 * x2
  let y2 = z0 * x1 - z1 * x0
  len = Math.hypot(y0, y1, y2)
  if (!len) {
    y0 = 0
    y1 = 0
    y2 = 0
  } else {
    len = 1 / len
    y0 *= len
    y1 *= len
    y2 *= len
  }

  out[0] = x0
  out[1] = y0
  out[2] = z0
  out[3] = 0
  out[4] = x1
  out[5] = y1
  out[6] = z1
  out[7] = 0
  out[8] = x2
  out[9] = y2
  out[10] = z2
  out[11] = 0
  out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez)
  out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez)
  out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez)
  out[15] = 1
  return out
}

export const multiply = (out: Mat4, a: Mat4, b: Mat4): Mat4 => {
  const a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3]
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7]
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11]
  const a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15]

  let b0 = b[0],
    b1 = b[1],
    b2 = b[2],
    b3 = b[3]
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  b0 = b[4]
  b1 = b[5]
  b2 = b[6]
  b3 = b[7]
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  b0 = b[8]
  b1 = b[9]
  b2 = b[10]
  b3 = b[11]
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  b0 = b[12]
  b1 = b[13]
  b2 = b[14]
  b3 = b[15]
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
  return out
}

export const translate = (out: Mat4, a: Mat4, v: Vec3): Mat4 => {
  const x = v[0],
    y = v[1],
    z = v[2]
  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12]
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13]
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14]
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15]
  } else {
    const a00 = a[0],
      a01 = a[1],
      a02 = a[2],
      a03 = a[3]
    const a10 = a[4],
      a11 = a[5],
      a12 = a[6],
      a13 = a[7]
    const a20 = a[8],
      a21 = a[9],
      a22 = a[10],
      a23 = a[11]
    out[0] = a00
    out[1] = a01
    out[2] = a02
    out[3] = a03
    out[4] = a10
    out[5] = a11
    out[6] = a12
    out[7] = a13
    out[8] = a20
    out[9] = a21
    out[10] = a22
    out[11] = a23
    out[12] = a00 * x + a10 * y + a20 * z + a[12]
    out[13] = a01 * x + a11 * y + a21 * z + a[13]
    out[14] = a02 * x + a12 * y + a22 * z + a[14]
    out[15] = a03 * x + a13 * y + a23 * z + a[15]
  }
  return out
}

export const rotate = (out: Mat4, a: Mat4, rad: number, axis: Vec3): Mat4 => {
  let x = axis[0],
    y = axis[1],
    z = axis[2]
  let len = Math.sqrt(x * x + y * y + z * z)
  if (len < EPSILON) return out
  len = 1 / len
  x *= len
  y *= len
  z *= len

  const s = Math.sin(rad)
  const c = Math.cos(rad)
  const t = 1 - c

  const a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3]
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7]
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11]

  const b00 = x * x * t + c,
    b01 = y * x * t + z * s,
    b02 = z * x * t - y * s
  const b10 = x * y * t - z * s,
    b11 = y * y * t + c,
    b12 = z * y * t + x * s
  const b20 = x * z * t + y * s,
    b21 = y * z * t - x * s,
    b22 = z * z * t + c

  out[0] = a00 * b00 + a10 * b01 + a20 * b02
  out[1] = a01 * b00 + a11 * b01 + a21 * b02
  out[2] = a02 * b00 + a12 * b01 + a22 * b02
  out[3] = a03 * b00 + a13 * b01 + a23 * b02
  out[4] = a00 * b10 + a10 * b11 + a20 * b12
  out[5] = a01 * b10 + a11 * b11 + a21 * b12
  out[6] = a02 * b10 + a12 * b11 + a22 * b12
  out[7] = a03 * b10 + a13 * b11 + a23 * b12
  out[8] = a00 * b20 + a10 * b21 + a20 * b22
  out[9] = a01 * b20 + a11 * b21 + a21 * b22
  out[10] = a02 * b20 + a12 * b21 + a22 * b22
  out[11] = a03 * b20 + a13 * b21 + a23 * b22
  if (a !== out) {
    out[12] = a[12]
    out[13] = a[13]
    out[14] = a[14]
    out[15] = a[15]
  }
  return out
}

export const scale = (out: Mat4, a: Mat4, v: Vec3): Mat4 => {
  const x = v[0],
    y = v[1],
    z = v[2]
  out[0] = a[0] * x
  out[1] = a[1] * x
  out[2] = a[2] * x
  out[3] = a[3] * x
  out[4] = a[4] * y
  out[5] = a[5] * y
  out[6] = a[6] * y
  out[7] = a[7] * y
  out[8] = a[8] * z
  out[9] = a[9] * z
  out[10] = a[10] * z
  out[11] = a[11] * z
  out[12] = a[12]
  out[13] = a[13]
  out[14] = a[14]
  out[15] = a[15]
  return out
}

export const transpose = (out: Mat4, a: Mat4): Mat4 => {
  if (out === a) {
    const a01 = a[1],
      a02 = a[2],
      a03 = a[3]
    const a12 = a[6],
      a13 = a[7],
      a23 = a[11]
    out[1] = a[4]
    out[2] = a[8]
    out[3] = a[12]
    out[4] = a01
    out[6] = a[9]
    out[7] = a[13]
    out[8] = a02
    out[9] = a12
    out[11] = a[14]
    out[12] = a03
    out[13] = a13
    out[14] = a23
  } else {
    out[0] = a[0]
    out[1] = a[4]
    out[2] = a[8]
    out[3] = a[12]
    out[4] = a[1]
    out[5] = a[5]
    out[6] = a[9]
    out[7] = a[13]
    out[8] = a[2]
    out[9] = a[6]
    out[10] = a[10]
    out[11] = a[14]
    out[12] = a[3]
    out[13] = a[7]
    out[14] = a[11]
    out[15] = a[15]
  }
  return out
}

export const invert = (out: Mat4, a: Mat4): Mat4 | null => {
  const a00 = a[0],
    a01 = a[1],
    a02 = a[2],
    a03 = a[3]
  const a10 = a[4],
    a11 = a[5],
    a12 = a[6],
    a13 = a[7]
  const a20 = a[8],
    a21 = a[9],
    a22 = a[10],
    a23 = a[11]
  const a30 = a[12],
    a31 = a[13],
    a32 = a[14],
    a33 = a[15]

  const b00 = a00 * a11 - a01 * a10
  const b01 = a00 * a12 - a02 * a10
  const b02 = a00 * a13 - a03 * a10
  const b03 = a01 * a12 - a02 * a11
  const b04 = a01 * a13 - a03 * a11
  const b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30
  const b07 = a20 * a32 - a22 * a30
  const b08 = a20 * a33 - a23 * a30
  const b09 = a21 * a32 - a22 * a31
  const b10 = a21 * a33 - a23 * a31
  const b11 = a22 * a33 - a23 * a32

  let det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  if (!det) return null
  det = 1.0 / det

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det
  return out
}

// Inverse-transpose of the upper-left 3x3 of a model matrix, returned as a
// mat4 (column 3 / row 3 identity) so it can be uploaded as a `mat4` uniform —
// this sidesteps the std140 mat3 = 3x vec4 padding trap. Use the upper-left 3x3
// in WGSL: `mat3x3f(normalMat[0].xyz, normalMat[1].xyz, normalMat[2].xyz)`.
export const normalMatrix = (out: Mat4, model: Mat4): Mat4 => {
  const inv = invert(create(), model)
  if (!inv) return identity(out)
  return transpose(out, inv)
}
