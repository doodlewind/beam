import { createCamera } from '../../utils/camera.js'
import { multiply } from '../../utils/mat4.js'

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
  // document.body.appendChild(canvas)
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

export const computeMVPMat = (modelMat, eye, canvas) => {
  const { viewMat, projectionMat } = createCamera({ eye }, { canvas })
  const viewProjectionMat = multiply([], projectionMat, viewMat)
  return multiply([], viewProjectionMat, modelMat)
}

export const createPointLights = () => ({
  'u_Lights[0].direction': [1, 0, 0],
  'u_Lights[0].color': [1, 1, 1],
  'u_Lights[0].strength': 1,
  'u_Lights[1].direction': [0, 0, 0],
  'u_Lights[1].color': [1, 1, 1],
  'u_Lights[1].strength': 0,
  'u_Lights[2].direction': [0, 0, 0],
  'u_Lights[2].color': [1, 1, 1],
  'u_Lights[2].strength': 0
})
