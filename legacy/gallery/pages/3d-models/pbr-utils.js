import { createCamera } from '../../utils/camera.js'
import { create, multiply, rotate } from '../../utils/mat4.js'
import { rotateY } from '../../utils/vec3.js'

export const rendererConfig = {
  contextAttributes: {
    preserveDrawingBuffer: true
  }
}

const createSolidCanvas = (color, width = 16, height = 16) => {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = width
  canvas.height = height
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

export const createMaterialImages = () => {
  const whiteCanvas = createSolidCanvas('white')
  const mrCanvas = createSolidCanvas('#00ffff') // OORRMM
  const normalCanvas = createSolidCanvas('#807fff')

  return {
    uBaseColorSampler: { image: whiteCanvas, repeat: true },
    uNormalSampler: { image: normalCanvas, repeat: true },
    uMetallicRoughnessSampler: { image: mrCanvas, repeat: true }
  }
}

export const computeModelMat = (rx, ry, rz) => {
  const modelMat = create()
  rotate(modelMat, modelMat, rx / 180 * Math.PI, [1, 0, 0])
  rotate(modelMat, modelMat, ry / 180 * Math.PI, [0, 1, 0])
  rotate(modelMat, modelMat, rz / 180 * Math.PI, [0, 0, 1])
  return modelMat
}

export const computeEye = (eye, r) => {
  return rotateY([], eye, [0, 0, 0], r / 180 * Math.PI)
}

export const computeMVPMat = (modelMat, eye, center, canvas) => {
  const { viewMat, projectionMat } = createCamera({ eye, center }, { canvas })
  const viewProjectionMat = multiply([], projectionMat, viewMat)
  return multiply([], viewProjectionMat, modelMat)
}

export const createPointLights = () => ({
  'uLights[0].direction': [0, 0, 0],
  'uLights[0].color': [1, 1, 1],
  'uLights[0].strength': 0,
  'uLights[1].direction': [0, 0, 0],
  'uLights[1].color': [1, 1, 1],
  'uLights[1].strength': 0,
  'uLights[2].direction': [0, 0, 0],
  'uLights[2].color': [1, 1, 1],
  'uLights[2].strength': 0
})
