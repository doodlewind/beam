// TODO correct shadow map

import { Beam, ResourceTypes } from '../../../src/index.js'
import { LambertLighting } from '../../plugins/basic-lighting-plugin.js'
import { CheckDepth } from './check-depth.js'
import {
  createBall, createRect
} from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create, translate } from '../../utils/mat4.js'
import { initOffscreen, Offscreen2DCommand } from './utils.js'
const {
  DataBuffers, IndexBuffer, Uniforms, Textures, Offscreen
} = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas, {
  extensions: [
    'OES_element_index_uint', 'WEBGL_depth_texture'
  ]
})
beam.define(Offscreen2DCommand)
window.beam = beam
const lightingPlugin = beam.plugin(LambertLighting)
const checkDepthPlugin = beam.plugin(CheckDepth)

const eye = [0, 50, 50]
const center = [10, 10, 0]

const camera = createCamera(
  { eye, center }, { canvas, zNear: 0.1, zFar: 100 }
)
const matRes = beam.resource(Uniforms, camera)
const lightRes = beam.resource(Uniforms)
lightRes.set('dirLight.direction', [1, 1, 1])

const ball = createBall()
const dataRes = beam.resource(DataBuffers, ball.data)
const indexRes = beam.resource(IndexBuffer, ball.index)

const offscreenRes = beam.resource(Offscreen, {
  depth: true,
  init: initOffscreen
})
const imgRes = beam.resource(Textures)
imgRes.set('img', offscreenRes)

// screen quad
const quadRect = createRect()
const quadDataRes = beam.resource(DataBuffers, quadRect.data)
const quadIndexRes = beam.resource(IndexBuffer, quadRect.index)

const baseModelMat = create()

const drawBalls = () => {
  for (let i = 1; i < 10; i++) {
    for (let j = 1; j < 10; j++) {
      const modelMat = translate([], baseModelMat, [i * 2, j * 2, 0])
      matRes.set('modelMat', modelMat)
      beam.draw(lightingPlugin, dataRes, indexRes, matRes, lightRes)
    }
  }
}

const render = () => {
  beam.clear()
  beam.offscreen2D(offscreenRes, drawBalls)

  const configRes = beam.resource(Uniforms, { nearPlane: 0.1, farPlane: 100 })
  beam.draw(checkDepthPlugin, quadDataRes, quadIndexRes, configRes, imgRes)

  // default draw to screen
  // beam.clear(); drawBalls()
}

render()

const $dirX = document.getElementById('dir-x')
const $dirY = document.getElementById('dir-y')
const $dirZ = document.getElementById('dir-z')
  ;[$dirX, $dirY, $dirZ].forEach(input => {
  input.addEventListener('input', () => {
    const [dx, dy, dz] = [$dirX.value, $dirY.value, $dirZ.value]
    lightRes.set('dirLight.direction', [dx, dy, dz])
    render()
  })
})

const $dirStrength = document.getElementById('dir-strength')
$dirStrength.addEventListener('input', () => {
  lightRes.set('dirLight.strength', $dirStrength.value)
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
  lightRes.set('dirLight.color', rgb)
  render()
})
