import { Beam, ResourceTypes, Offscreen2DCommand } from '../../../src/index.js'
import {
  LambertLighting, ShadowMap
} from '../../plugins/basic-lighting-plugin.js'
import {
  createBall, createRect, mergeGraphics
} from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create, rotate } from '../../utils/mat4.js'
const {
  DataBuffers, IndexBuffer, Uniforms, Textures, Offscreen
} = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas)
beam.define(Offscreen2DCommand)

const lighting = beam.plugin(LambertLighting)
const shadow = beam.plugin(ShadowMap)

let lightPos = [0, 0, 10]
const shadowCameraState = createCamera({ eye: lightPos }, { canvas })
const shadowCamera = beam.resource(
  Uniforms,
  {
    viewMat: shadowCameraState.viewMat,
    projectionMat: shadowCameraState.projectionMat,
    lightViewMat: shadowCameraState.viewMat,
    lightProjectionMat: shadowCameraState.projectionMat
  }
)
const shadowCache = beam.resource(Textures, { depth: true })
shadowCache.set('shadowMap', beam.resource(Offscreen))

const actualCamera = beam.resource(
  Uniforms, createCamera({ eye: [0, 0, 20] }, { canvas })
)
const light = beam.resource(Uniforms)
light.set('dirLight.direction', [0, 0, 1])

const ball = createBall()
const rect = createRect([0, 0, -1], 1, 2.5)
const graphics = mergeGraphics(ball, rect)
const buffers = [
  beam.resource(DataBuffers, graphics.data),
  beam.resource(IndexBuffer, graphics.index)
]

const render = () => {
  beam.clear()

  beam.offscreen2D(shadowCache.state.shadowMap, () => {
    beam.clear().draw(shadow, ...buffers, shadowCamera)
  })

  beam.draw(
    lighting, ...buffers, shadowCamera, actualCamera, shadowCache, light
  )

  // beam.draw(shadow, ...buffers, shadowCamera)
}

render()

const $modelX = document.getElementById('model-x')
const $modelY = document.getElementById('model-y')
const $modelZ = document.getElementById('model-z')
  ;[$modelX, $modelY, $modelZ].forEach(input => {
  input.addEventListener('input', () => {
    const [rx, ry, rz] = [$modelX.value, $modelY.value, $modelZ.value]
    const modelMat = create()
    rotate(modelMat, modelMat, rx / 180 * Math.PI, [1, 0, 0])
    rotate(modelMat, modelMat, ry / 180 * Math.PI, [0, 1, 0])
    rotate(modelMat, modelMat, rz / 180 * Math.PI, [0, 0, 1])
    actualCamera.set('modelMat', modelMat)
    render()
  })
})

const $dirX = document.getElementById('dir-x')
const $dirY = document.getElementById('dir-y')
const $dirZ = document.getElementById('dir-z')
  ;[$dirX, $dirY, $dirZ].forEach(input => {
  input.addEventListener('input', () => {
    const [dx, dy, dz] = [$dirX.value, $dirY.value, $dirZ.value]
    light.set('dirLight.direction', [dx, dy, dz])

    lightPos = [dx, dy, dz]
    const shadowCameraState = createCamera({ eye: lightPos }, { canvas })
    shadowCamera
      .set('viewMat', shadowCameraState.viewMat)
      .set('projectionMat', shadowCameraState.projectionMat)
      .set('lightViewMat', shadowCameraState.viewMat)
      .set('lightProjectionMat', shadowCameraState.projectionMat)

    render()
  })
})

const $dirStrength = document.getElementById('dir-strength')
$dirStrength.addEventListener('input', () => {
  light.set('dirLight.strength', $dirStrength.value)
  render()
})

const $dirColor = document.getElementById('dir-color')
$dirColor.addEventListener('input', () => {
  const hex = $dirColor.value
  const rgb = [
    parseInt(hex.slice(1, 3), 16) / 256,
    parseInt(hex.slice(3, 5), 16) / 256,
    parseInt(hex.slice(5, 7), 16) / 256
  ]
  light.set('dirLight.color', rgb)
  render()
})
