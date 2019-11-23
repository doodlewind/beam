import { Beam, ResourceTypes, GLTypes as GL } from '../../../src/index.js'
import { PBRLighting } from '../../shaders/pbr-lighting-shader.js'
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
const { VertexBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas, rendererConfig)

const shader = beam.shader(PBRLighting)

// Resources: vertex buffers and index buffer
const ball = createBall()
const ballBuffers = [
  beam.resource(VertexBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index)
]

// Resources: camera and model matrices
const baseEye = [0, 0, 10]
const center = [0, 0, 0]
const modelMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const matrices = beam.resource(Uniforms, {
  uCamera: baseEye,
  uModelMatrix: modelMat,
  uMVPMatrix: computeMVPMat(modelMat, baseEye, center, canvas)
})

// Resources: point light states
const pointLights = beam.resource(Uniforms, createPointLights())
pointLights
  .set(`uLights[0].direction`, [1, 1, 1])
  .set(`uLights[0].strength`, 1)

// Resources: material images
const materialMaps = beam.resource(Textures, createMaterialImages())

// Resources: environment maps and BRDF map
let brdfMap
let envMaps

// Resourecs: other options
const pbrOptions = beam.resource(Uniforms, {
  uMetallicRoughnessValues: [0, 0]
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
  beam.clear().draw(shader, ...resources)
}

const base = '../../assets/'
Promise.all([
  loadEnvMaps(base + 'ibl/helipad'), loadImages(base + 'ibl/brdfLUT.png')
]).then(([[diffuseState, specularState], [brdf]]) => {
  diffuseState.minFilter = GL.Linear
  diffuseState.space = GL.SRGB

  specularState.minFilter = GL.LinearMipmapLinear
  specularState.space = GL.SRGB

  brdfMap = beam.resource(Textures, {
    uBrdfLUT: { image: brdf, wrapS: GL.ClampToEdge, wrapT: GL.ClampToEdge }
  })
  envMaps = beam.resource(Textures, {
    uDiffuseEnvSampler: diffuseState,
    uSpecularEnvSampler: specularState
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
    .set('uModelMatrix', modelMat)
    .set('uCamera', eye)
    .set('uMVPMatrix', computeMVPMat(modelMat, eye, center, canvas))
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
  pbrOptions.set('uMetallicRoughnessValues', mr)
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
      .set(`uLights[${i}].direction`, direction)
      .set(`uLights[${i}].strength`, $lightStrength.value)
      .set(`uLights[${i}].color`, rgb)
    render()
  }
  ;[$lightX, $lightY, $lightZ, $lightStrength, $lightColor].forEach($input => {
    $input.addEventListener('input', updatePointLights)
  })
}

window.beam = beam
