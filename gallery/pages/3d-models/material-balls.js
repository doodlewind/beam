import { Beam, ResourceTypes, GLTypes as GL } from '../../../src/index.js'
import { PBRLighting } from '../../plugins/pbr-lighting-plugin.js'
import { createBall } from '../../utils/graphics-utils.js'
import { loadImages, loadEnvMaps } from '../../utils/image-loader.js'
import { translate } from '../../utils/mat4.js'
import {
  rendererConfig, createMaterialImages, computeMVPMat, createPointLights
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
const eye = [0, 50, 50]
const center = [10, 10, 0]
const baseModelMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const matrices = beam.resource(Uniforms, {
  uCamera: eye,
  uModelMatrix: baseModelMat,
  uMVPMatrix: computeMVPMat(baseModelMat, eye, canvas)
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
  beam.clear()
  for (let i = 1; i < 10; i++) {
    for (let j = 1; j < 10; j++) {
      const modelMat = translate([], baseModelMat, [i * 2, j * 2, 0])
      pbrOptions.set('uMetallicRoughnessValues', [i / 10, j / 10])
      matrices
        .set('uModelMatrix', modelMat)
        .set('uMVPMatrix', computeMVPMat(modelMat, eye, center, canvas))

      const resources = [
        ...ballBuffers,
        brdfMap,
        envMaps,
        materialMaps,
        matrices,
        pointLights,
        pbrOptions
      ]
      beam.draw(plugin, ...resources)
    }
  }
}

const base = '../../assets/'
Promise.all([
  loadEnvMaps(base + 'ibl/helipad'), loadImages(base + 'ibl/brdfLUT.png')
]).then(([[diffuseState, specularState], [brdf]]) => {
  diffuseState.minFilter = GL.Linear
  diffuseState.space = GL.SRGB

  specularState.minFilter = GL.LinearMipmapLinear
  specularState.space = GL.SRGB

  brdfMap = beam.resource(Textures, { uBrdfLUT: { image: brdf } })
  envMaps = beam.resource(Textures, {
    uDiffuseEnvSampler: diffuseState,
    uSpecularEnvSampler: specularState
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
