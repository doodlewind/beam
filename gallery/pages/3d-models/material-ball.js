import { Beam, ResourceTypes } from '../../../src/index.js'
import { PBRLighting } from '../../plugins/pbr-lighting-plugin.js'
import { createBall } from '../../utils/graphics-utils.js'
import { loadImages, loadEnvMaps } from '../../utils/image-loader.js'
import {
  rendererConfig,
  createMaterialImages,
  computeModelMat,
  computeEye,
  computeMVPMat,
  createPointLights
} from './pbr-utils.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas, rendererConfig)

if (beam.gl.extensions.EXT_shader_texture_lod) {
  PBRLighting.defines.USE_TEX_LOD = 1 // COMPAT Android fallback
}
const plugin = beam.plugin(PBRLighting)

// Resources: data buffers and index buffer
const ball = createBall()
const ballBuffers = [
  beam.resource(DataBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index)
]

// Resources: camera and model matrices
const baseEye = [0, 0, 10]
const center = [0, 0, 0]
const modelMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const matrices = beam.resource(Uniforms, {
  u_Camera: baseEye,
  u_ModelMatrix: modelMat,
  u_MVPMatrix: computeMVPMat(modelMat, baseEye, center, canvas)
})

// Resources: point light states
const pointLights = beam.resource(Uniforms, createPointLights())
pointLights
  .set(`u_Lights[0].direction`, [1, 1, 1])
  .set(`u_Lights[0].strength`, 1)

// Resources: material images
const materialMaps = beam.resource(Textures, createMaterialImages())

// Resources: environment maps and BRDF map
let brdfMap
let envMaps

// Resourecs: other options
const pbrOptions = beam.resource(Uniforms, {
  u_MetallicRoughnessValues: [0, 0]
})

const render = () => {
  const resources = [
    ...ballBuffers,
    brdfMap,
    envMaps,
    materialMaps,
    matrices,
    pointLights,
    pbrOptions
  ]
  beam.clear().draw(plugin, ...resources)
}

const base = '../../assets/'
Promise.all([
  loadEnvMaps(base + 'ibl/helipad'), loadImages(base + 'ibl/brdfLUT.png')
]).then(([[diffuseMaps, specularMaps], [brdf]]) => {
  brdfMap = beam.resource(Textures, { u_brdfLUT: { image: brdf } })
  envMaps = beam.resource(Textures, {
    u_DiffuseEnvSampler: diffuseMaps,
    u_SpecularEnvSampler: specularMaps
  })
  render()
})

// Update Rotates
const $xRotate = document.getElementById('x-rotate')
const $yRotate = document.getElementById('y-rotate')
const $zRotate = document.getElementById('z-rotate')
const $cameraRotate = document.getElementById('camera-rotate')
const updateMats = () => {
  const [rx, ry, rz] = [$xRotate.value, $yRotate.value, $zRotate.value]
  const cameraRotate = $cameraRotate.value
  const modelMat = computeModelMat(rx, ry, rz)
  const eye = computeEye(baseEye, cameraRotate)
  matrices
    .set('u_ModelMatrix', modelMat)
    .set('u_Camera', eye)
    .set('u_MVPMatrix', computeMVPMat(modelMat, eye, center, canvas))
  render()
}
;[$xRotate, $yRotate, $zRotate, $cameraRotate].forEach($input => {
  $input.addEventListener('input', updateMats)
})

// Update Metalness Roughness
const $metallic = document.getElementById('metallic')
const $roughness = document.getElementById('roughness')
const updateMetalRoughness = () => {
  const mr = [$metallic.value, $roughness.value]
  pbrOptions.set('u_MetallicRoughnessValues', mr)
  render()
}
$metallic.addEventListener('input', updateMetalRoughness)
$roughness.addEventListener('input', updateMetalRoughness)

// Update Lights
for (let i = 0; i < 1; i++) {
  const $lightX = document.getElementById(`light-${i}-x`)
  const $lightY = document.getElementById(`light-${i}-y`)
  const $lightZ = document.getElementById(`light-${i}-z`)
  const $lightStrength = document.getElementById(`light-${i}-strength`)
  const $lightColor = document.getElementById(`light-${i}-color`)
  const updatePointLights = () => {
    const direction = [$lightX.value, $lightY.value, $lightZ.value]
    const hex = $lightColor.value
    const rgb = [
      parseInt(hex.slice(1, 3), 16) / 256,
      parseInt(hex.slice(3, 5), 16) / 256,
      parseInt(hex.slice(5, 7), 16) / 256
    ]
    pointLights
      .set(`u_Lights[${i}].direction`, direction)
      .set(`u_Lights[${i}].strength`, $lightStrength.value)
      .set(`u_Lights[${i}].color`, rgb)
    render()
  }
  ;[$lightX, $lightY, $lightZ, $lightStrength, $lightColor].forEach($input => {
    $input.addEventListener('input', updatePointLights)
  })
}

window.beam = beam
