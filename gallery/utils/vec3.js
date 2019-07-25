export const rotateX = (out, a, b, c) => {
  let [p, r] = [[], []]
  // Translate point to the origin
  p[0] = a[0] - b[0]
  p[1] = a[1] - b[1]
  p[2] = a[2] - b[2]

  // perform rotation
  r[0] = p[0]
  r[1] = p[1] * Math.cos(c) - p[2] * Math.sin(c)
  r[2] = p[1] * Math.sin(c) + p[2] * Math.cos(c)

  // translate to correct position
  out[0] = r[0] + b[0]
  out[1] = r[1] + b[1]
  out[2] = r[2] + b[2]

  return out
}

export const rotateY = (out, a, b, c) => {
  let [p, r] = [[], []]
  // Translate point to the origin
  p[0] = a[0] - b[0]
  p[1] = a[1] - b[1]
  p[2] = a[2] - b[2]

  // perform rotation
  r[0] = p[2] * Math.sin(c) + p[0] * Math.cos(c)
  r[1] = p[1]
  r[2] = p[2] * Math.cos(c) - p[0] * Math.sin(c)

  // translate to correct position
  out[0] = r[0] + b[0]
  out[1] = r[1] + b[1]
  out[2] = r[2] + b[2]

  return out
}

export const rotateZ = (out, a, b, c) => {
  let [p, r] = [[], []]
  // Translate point to the origin
  p[0] = a[0] - b[0]
  p[1] = a[1] - b[1]
  p[2] = a[2] - b[2]

  // perform rotation
  r[0] = p[0] * Math.cos(c) - p[1] * Math.sin(c)
  r[1] = p[0] * Math.sin(c) + p[1] * Math.cos(c)
  r[2] = p[2]

  // translate to correct position
  out[0] = r[0] + b[0]
  out[1] = r[1] + b[1]
  out[2] = r[2] + b[2]

  return out
}
