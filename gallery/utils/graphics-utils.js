const push = (arr, x) => { arr[arr.length] = x }

export const createBox = (center = [0, 0, 0]) => {
  const basePositions = [
    // Front face
    -1.0, -1.0, 1.0,
    1.0, -1.0, 1.0,
    1.0, 1.0, 1.0,
    -1.0, 1.0, 1.0,

    // Back face
    -1.0, -1.0, -1.0,
    -1.0, 1.0, -1.0,
    1.0, 1.0, -1.0,
    1.0, -1.0, -1.0,

    // Top face
    -1.0, 1.0, -1.0,
    -1.0, 1.0, 1.0,
    1.0, 1.0, 1.0,
    1.0, 1.0, -1.0,

    // Bottom face
    -1.0, -1.0, -1.0,
    1.0, -1.0, -1.0,
    1.0, -1.0, 1.0,
    -1.0, -1.0, 1.0,

    // Right face
    1.0, -1.0, -1.0,
    1.0, 1.0, -1.0,
    1.0, 1.0, 1.0,
    1.0, -1.0, 1.0,

    // Left face
    -1.0, -1.0, -1.0,
    -1.0, -1.0, 1.0,
    -1.0, 1.0, 1.0,
    -1.0, 1.0, -1.0
  ]

  const normal = [
    // Front
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,
    0.0, 0.0, 1.0,

    // Back
    0.0, 0.0, -1.0,
    0.0, 0.0, -1.0,
    0.0, 0.0, -1.0,
    0.0, 0.0, -1.0,

    // Top
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,
    0.0, 1.0, 0.0,

    // Bottom
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, -1.0, 0.0,

    // Right
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,
    1.0, 0.0, 0.0,

    // Left
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0,
    -1.0, 0.0, 0.0
  ]

  const texCoord = [
    // Front
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,
    // Back
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,
    // Top
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,
    // Bottom
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,
    // Right
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0,
    // Left
    0.0, 0.0,
    1.0, 0.0,
    1.0, 1.0,
    0.0, 1.0
  ]

  const index = [
    0, 1, 2, 0, 2, 3, // Front
    4, 5, 6, 4, 6, 7, // Back
    8, 9, 10, 8, 10, 11, // Top
    12, 13, 14, 12, 14, 15, // Bottom
    16, 17, 18, 16, 18, 19, // Right
    20, 21, 22, 20, 22, 23 // Left
  ]

  const p = center
  const position = []
  for (let i = 0; i < basePositions.length; i += 3) {
    push(position, basePositions[i] + p[0])
    push(position, basePositions[i + 1] + p[1])
    push(position, basePositions[i + 2] + p[2])
  }

  return {
    data: { position, normal, texCoord }, index: { array: index }
  }
}

export const createBall = (
  center = [0, 0, 0], radius = 1, latBands = 50, longBands = 50
) => {
  const position = []
  const normal = []
  const texCoord = []
  const index = []

  for (let letNum = 0; letNum <= latBands; letNum++) {
    const theta = letNum * Math.PI / latBands
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)

    for (let longNumber = 0; longNumber <= longBands; longNumber++) {
      const phi = longNumber * 2 * Math.PI / longBands
      const sinPhi = Math.sin(phi)
      const cosPhi = Math.cos(phi)

      const x = cosPhi * sinTheta
      const y = cosTheta
      const z = sinPhi * sinTheta

      const u = 1 - (longNumber / longBands)
      const v = 1 - (letNum / latBands)

      push(position, radius * x + center[0])
      push(position, radius * y + center[1])
      push(position, radius * z + center[2])

      push(normal, x)
      push(normal, y)
      push(normal, z)

      push(texCoord, u)
      push(texCoord, v)
    }
  }

  for (let letNum = 0; letNum < latBands; letNum++) {
    for (let longNum = 0; longNum < longBands; longNum++) {
      const first = (letNum * (longBands + 1)) + longNum
      const second = first + longBands + 1

      push(index, first)
      push(index, second)
      push(index, first + 1)

      push(index, second)
      push(index, second + 1)
      push(index, first + 1)
    }
  }

  return {
    data: { position, normal, texCoord }, index: { array: index }
  }
}

export const createRect = (center = [0, 0, 0], aspectRatio = 1) => {
  const basePositions = [
    -1.0, -1.0 * aspectRatio, 0.0,
    1.0, -1.0 * aspectRatio, 0.0,
    1.0, 1.0 * aspectRatio, 0.0,
    -1.0, 1.0 * aspectRatio, 0.0
  ]
  const position = []
  for (let i = 0; i < basePositions.length; i += 3) {
    push(position, basePositions[i] + center[0])
    push(position, basePositions[i + 1] + center[1])
    push(position, basePositions[i + 2] + center[2])
  }

  return {
    data: {
      position,
      normal: [
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0,
        0.0, 0.0, 1.0
      ],
      texCoord: [
        0.0, 0.0,
        1.0, 0.0,
        1.0, 1.0,
        0.0, 1.0
      ]
    },
    index: { array: [0, 1, 2, 0, 2, 3] }
  }
}
