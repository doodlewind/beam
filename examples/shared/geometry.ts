// Procedural geometry — typed port of the old gallery graphics-utils.
// Each builder returns data shaped for the new API:
//   beam.verts(schema, graphics.vertex)  +  beam.index(graphics.index)
export interface Graphics {
  vertex: { position: number[]; normal: number[]; texCoord: number[] }
  index: { array: number[] }
}

const push = (arr: number[], x: number) => {
  arr[arr.length] = x
}
const concat = (baseArr: number[], newArr: number[]) => {
  const baseLength = baseArr.length
  for (let i = 0; i < newArr.length; i++) baseArr[baseLength + i] = newArr[i]
}

export const createBox = (center: number[] = [0, 0, 0]): Graphics => {
  const basePositions = [
    -1,
    -1,
    1,
    1,
    -1,
    1,
    1,
    1,
    1,
    -1,
    1,
    1, // Front
    -1,
    -1,
    -1,
    -1,
    1,
    -1,
    1,
    1,
    -1,
    1,
    -1,
    -1, // Back
    -1,
    1,
    -1,
    -1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    -1, // Top
    -1,
    -1,
    -1,
    1,
    -1,
    -1,
    1,
    -1,
    1,
    -1,
    -1,
    1, // Bottom
    1,
    -1,
    -1,
    1,
    1,
    -1,
    1,
    1,
    1,
    1,
    -1,
    1, // Right
    -1,
    -1,
    -1,
    -1,
    -1,
    1,
    -1,
    1,
    1,
    -1,
    1,
    -1, // Left
  ]
  const normal = [
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]
  const texCoord = [
    0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0,
    0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1,
  ]
  const index = [
    0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14,
    15, 16, 17, 18, 16, 18, 19, 20, 21, 22, 20, 22, 23,
  ]
  const position: number[] = []
  for (let i = 0; i < basePositions.length; i += 3) {
    push(position, basePositions[i] + center[0])
    push(position, basePositions[i + 1] + center[1])
    push(position, basePositions[i + 2] + center[2])
  }
  return { vertex: { position, normal, texCoord }, index: { array: index } }
}

export const createBall = (
  center: number[] = [0, 0, 0],
  radius = 1,
  latBands = 50,
  longBands = 50
): Graphics => {
  const position: number[] = []
  const normal: number[] = []
  const texCoord: number[] = []
  const index: number[] = []

  for (let latNum = 0; latNum <= latBands; latNum++) {
    const theta = (latNum * Math.PI) / latBands
    const sinTheta = Math.sin(theta)
    const cosTheta = Math.cos(theta)
    for (let longNum = 0; longNum <= longBands; longNum++) {
      const phi = (longNum * 2 * Math.PI) / longBands
      const x = Math.cos(phi) * sinTheta
      const y = cosTheta
      const z = Math.sin(phi) * sinTheta
      const u = 1 - longNum / longBands
      const v = 1 - latNum / latBands
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
  for (let latNum = 0; latNum < latBands; latNum++) {
    for (let longNum = 0; longNum < longBands; longNum++) {
      const first = latNum * (longBands + 1) + longNum
      const second = first + longBands + 1
      push(index, first)
      push(index, second)
      push(index, first + 1)
      push(index, second)
      push(index, second + 1)
      push(index, first + 1)
    }
  }
  return { vertex: { position, normal, texCoord }, index: { array: index } }
}

export const createRect = (
  center: number[] = [0, 0, 0],
  aspectRatio = 1,
  scale = 1
): Graphics => {
  const basePositions = [
    -1,
    -1 * aspectRatio,
    0,
    1,
    -1 * aspectRatio,
    0,
    1,
    1 * aspectRatio,
    0,
    -1,
    1 * aspectRatio,
    0,
  ].map((x) => x * scale)
  const position: number[] = []
  for (let i = 0; i < basePositions.length; i += 3) {
    push(position, basePositions[i] + center[0])
    push(position, basePositions[i + 1] + center[1])
    push(position, basePositions[i + 2] + center[2])
  }
  return {
    vertex: {
      position,
      normal: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      texCoord: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    index: { array: [0, 1, 2, 0, 2, 3] },
  }
}

// Triangle index array -> line-list index array (for `primitive: 'line'`).
export const toWireframe = (index: {
  array: number[]
}): { array: number[] } => {
  const { array = [] } = index
  const wireframe = new Array<number>(array.length * 2)
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

export const mergeGraphics = (...graphicsObjects: Graphics[]): Graphics => {
  const base: Graphics = {
    vertex: { position: [], normal: [], texCoord: [] },
    index: { array: [] },
  }
  for (const graphics of graphicsObjects) {
    const { array } = graphics.index
    const offset = base.vertex.position.length / 3
    const offsetArray = new Array<number>(array.length)
    for (let j = 0; j < array.length; j++) offsetArray[j] = array[j] + offset
    concat(base.index.array, offsetArray)
    concat(base.vertex.position, graphics.vertex.position)
    concat(base.vertex.normal, graphics.vertex.normal)
    concat(base.vertex.texCoord, graphics.vertex.texCoord)
  }
  return base
}
