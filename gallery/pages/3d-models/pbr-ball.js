import { Beam, ResourceTypes } from '../../../src/index.js'
import { PBRLighting } from '../../plugins/pbr-lighting-plugin.js'
import { createBall } from '../../utils/graphics-utils.js'
import { loadImages, loadEnvMaps } from '../../utils/image-loader.js'
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
const eye = [0, 0, 10]
const modelMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const matrixResource = beam.resource(Uniforms, {
  u_Camera: eye,
  u_ModelMatrix: modelMat,
  u_MVPMatrix: computeMVPMat(modelMat, eye, canvas)
})

// Resources: point light states
const pointLightsResource = beam.resource(Uniforms, createPointLights())

// Resources: material images
const materialImagesResource = beam.resource(Textures, createMaterialImages())

// Resources: environment maps and BRDF map
let brdfResource
// let envResource

// Resourecs: other options
const optionResource = beam.resource(Uniforms, {
  u_MetallicRoughnessValues: [1, 0]
})

const base = '../../assets/'
Promise.all([
  loadEnvMaps(base + 'ibl/helipad'), loadImages(base + 'ibl/brdfLUT.png')
]).then(([[diffuseMaps, specularMaps], [brdf]]) => {
  brdfResource = beam.resource(Textures, { u_brdfLUT: { image: brdf } })
  // envResource = beam.resource(Textures, {
  //   u_DiffuseEnvSampler: diffuseMaps,
  //   u_SpecularEnvSampler: specularMaps
  // })

  beam.clear().draw(
    plugin,
    dataResource,
    indexResource,
    brdfResource,
    // envResource,
    pointLightsResource,
    materialImagesResource,
    matrixResource,
    optionResource
  )
})
