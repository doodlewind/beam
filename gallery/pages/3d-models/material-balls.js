import { Beam, ResourceTypes } from '../../../src/index.js'
import { PBRLighting } from '../../plugins/pbr-lighting-plugin.js'
import { createBall } from '../../utils/graphics-utils.js'
import { loadImages, loadEnvMaps } from '../../utils/image-loader.js'
import { translate } from '../../utils/mat4.js'
import {
  rendererConfig, createMaterialImages, computeMVPMat, createPointLights
} from './utils.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.getElementById('gl-canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas, rendererConfig)

const plugin = beam.plugin(PBRLighting)

// Resources: data buffers and index buffer
const ball = createBall()
const dataResource = beam.resource(DataBuffers, ball.data)
const indexResource = beam.resource(IndexBuffer, ball.index)

// Resources: camera and model matrices
const eye = [0, 50, 50]
const center = [10, 10, 0]
const baseModelMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const matrixResource = beam.resource(Uniforms, {
  u_Camera: eye,
  u_ModelMatrix: baseModelMat,
  u_MVPMatrix: computeMVPMat(baseModelMat, eye, canvas)
})

// Resources: point light states
const pointLightsResource = beam.resource(Uniforms, createPointLights())

// Resources: material images
const materialImagesResource = beam.resource(Textures, createMaterialImages())

// Resources: environment maps and BRDF map
let brdfResource
let envResource

// Resourecs: other options
const optionResource = beam.resource(Uniforms, {
  u_MetallicRoughnessValues: [0, 0]
})

const render = () => {
  beam.clear()
  for (let i = 1; i < 10; i++) {
    for (let j = 1; j < 10; j++) {
      const modelMat = translate([], baseModelMat, [i * 2, j * 2, 0])
      optionResource.set('u_MetallicRoughnessValues', [i / 10, j / 10])
      matrixResource
        .set('u_ModelMatrix', modelMat)
        .set('u_MVPMatrix', computeMVPMat(modelMat, eye, center, canvas))

      const resources = [
        dataResource,
        indexResource,
        brdfResource,
        envResource,
        pointLightsResource,
        materialImagesResource,
        matrixResource,
        optionResource
      ]
      beam.draw(plugin, ...resources)
    }
  }
}

const base = '../../assets/'
Promise.all([
  loadEnvMaps(base + 'ibl/helipad'), loadImages(base + 'ibl/brdfLUT.png')
]).then(([[diffuseMaps, specularMaps], [brdf]]) => {
  brdfResource = beam.resource(Textures, { u_brdfLUT: { image: brdf } })
  envResource = beam.resource(Textures, {
    u_DiffuseEnvSampler: diffuseMaps,
    u_SpecularEnvSampler: specularMaps
  })
  render()
})

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

    pointLightsResource
      .set(`u_Lights[${i}].direction`, direction)
      .set(`u_Lights[${i}].strength`, $lightStrength.value)
      .set(`u_Lights[${i}].color`, rgb)
    render()
  }
  ;[$lightX, $lightY, $lightZ, $lightStrength, $lightColor].forEach($input => {
    $input.addEventListener('input', updatePointLights)
  })
}
