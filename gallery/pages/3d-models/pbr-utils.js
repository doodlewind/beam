import { createCamera } from '../../utils/camera.js'
import { create, multiply, rotate } from '../../utils/mat4.js'
import { rotateY } from '../../utils/vec3.js'

export const rendererConfig = {
  extensions: [
    'EXT_shader_texture_lod',
    'EXT_SRGB',
    'OES_standard_derivatives',
    'OES_element_index_uint'
  ]
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
  const blackCanvas = createSolidCanvas('black')
  const whiteCanvas = createSolidCanvas('white')
  const mrCanvas = createSolidCanvas('#00ffff') // OORRMM
  const normalCanvas = createSolidCanvas('#807fff')

  return {
    u_BaseColorSampler: { image: whiteCanvas, repeat: true },
    u_NormalSampler: { image: normalCanvas, repeat: true },
    u_MetallicRoughnessSampler: { image: mrCanvas, repeat: true },
    u_EmissiveSampler: { image: blackCanvas },
    u_OcclusionSampler: { image: blackCanvas }
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
  'u_Lights[0].direction': [0, 0, 0],
  'u_Lights[0].color': [1, 1, 1],
  'u_Lights[0].strength': 0,
  'u_Lights[1].direction': [0, 0, 0],
  'u_Lights[1].color': [1, 1, 1],
  'u_Lights[1].strength': 0,
  'u_Lights[2].direction': [0, 0, 0],
  'u_Lights[2].color': [1, 1, 1],
  'u_Lights[2].strength': 0
})
