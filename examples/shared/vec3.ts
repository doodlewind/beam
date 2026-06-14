// Minimal vec3 helpers (typed port of the old gallery util).
export type Vec3 = number[] | Float32Array

export const rotateX = (out: Vec3, a: Vec3, b: Vec3, c: number): Vec3 => {
  const p = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const r = [
    p[0],
    p[1] * Math.cos(c) - p[2] * Math.sin(c),
    p[1] * Math.sin(c) + p[2] * Math.cos(c),
  ]
  out[0] = r[0] + b[0]
  out[1] = r[1] + b[1]
  out[2] = r[2] + b[2]
  return out
}

export const rotateY = (out: Vec3, a: Vec3, b: Vec3, c: number): Vec3 => {
  const p = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const r = [
    p[2] * Math.sin(c) + p[0] * Math.cos(c),
    p[1],
    p[2] * Math.cos(c) - p[0] * Math.sin(c),
  ]
  out[0] = r[0] + b[0]
  out[1] = r[1] + b[1]
  out[2] = r[2] + b[2]
  return out
}

export const rotateZ = (out: Vec3, a: Vec3, b: Vec3, c: number): Vec3 => {
  const p = [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
  const r = [
    p[0] * Math.cos(c) - p[1] * Math.sin(c),
    p[0] * Math.sin(c) + p[1] * Math.cos(c),
    p[2],
  ]
  out[0] = r[0] + b[0]
  out[1] = r[1] + b[1]
  out[2] = r[2] + b[2]
  return out
}

export const add = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  out[0] = a[0] + b[0]
  out[1] = a[1] + b[1]
  out[2] = a[2] + b[2]
  return out
}

export const subtract = (out: Vec3, a: Vec3, b: Vec3): Vec3 => {
  out[0] = a[0] - b[0]
  out[1] = a[1] - b[1]
  out[2] = a[2] - b[2]
  return out
}
