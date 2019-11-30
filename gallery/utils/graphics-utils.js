const push = (arr, x) => { arr[arr.length] = x }

const push2D = (arr, x, y) => {
  arr[arr.length] = x
  arr[arr.length] = y
}

const push3D = (arr, x, y, z) => {
  arr[arr.length] = x
  arr[arr.length] = y
  arr[arr.length] = z
}

const concat = (baseArr, newArr) => {
  const baseLength = baseArr.length
  for (let i = 0; i < newArr.length; i++) {
    baseArr[baseLength + i] = newArr[i]
  }
}

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

export const createCircle = (r = 1, center = [0, 0, 0]) => {
  const c = center
  const position = []
  const normal = []
  const texCoord = []
  const index = []

  push3D(position, c[0], c[1], c[2])
  push3D(normal, 0, 0, 0)
  push2D(texCoord, 0, 0)

  for (let i = 0; i < 200; i++) {
    const x = c[0] + r * Math.cos(i * 2 * Math.PI / 200)
    const y = c[1] + r * Math.sin(i * 2 * Math.PI / 200)
    push3D(position, x, y, c[2])
    push3D(normal, 0, 0, 1)
    push2D(texCoord, 0, 0)
  }
  for (let i = 0; i < 200; i++) {
    push3D(index, 0, i, i + 1)
  }
  push3D(index, 200, 1)
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

export const createRect = (center = [0, 0, 0], aspectRatio = 1, scale = 1) => {
  const basePositions = [
    -1.0, -1.0 * aspectRatio, 0.0,
    1.0, -1.0 * aspectRatio, 0.0,
    1.0, 1.0 * aspectRatio, 0.0,
    -1.0, 1.0 * aspectRatio, 0.0
  ].map(x => x * scale)
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

export const toWireframe = index => {
  const { array = [] } = index

  const wireframe = new Array(array.length * 2)
  for (let i = 0; i < array.length; i += 3) {
    wireframe[i * 2] = array[i]
    wireframe[i * 2 + 1] = array[i + 1]

    wireframe[i * 2 + 2] = array[i + 1]
    wireframe[i * 2 + 3] = array[i + 2]

    wireframe[i * 2 + 4] = array[i]
    wireframe[i * 2 + 5] = array[i + 2]
  }

  return { array: wireframe }
}

export const mergeGraphics = (...graphicsObjects) => {
  const base = {
    data: { position: [], normal: [], texCoord: [] },
    index: { array: [] }
  }

  for (let i = 0; i < graphicsObjects.length; i++) {
    const graphics = graphicsObjects[i]
    const { array } = graphics.index
    const offsetArray = new Array(array.length)
    const offset = base.data.position.length / 3
    for (let j = 0; j < array.length; j++) {
      offsetArray[j] = array[j] + offset
    }
    concat(base.index.array, offsetArray)

    concat(base.data.position, graphics.data.position)
    concat(base.data.normal, graphics.data.normal)
    concat(base.data.texCoord, graphics.data.texCoord)
  }

  return base
}
