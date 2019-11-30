import { Beam, ResourceTypes, Offscreen2DCommand } from '../../../src/index.js'
import { LambertLighting } from '../../shaders/basic-lighting-shader.js'
import { BasicImage } from '../../shaders/image-filter-shaders.js'
import {
  createBall, createRect, mergeGraphics
} from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create, rotate } from '../../utils/mat4.js'
const {
  VertexBuffers, IndexBuffer, Uniforms, Textures, OffscreenTarget
} = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas)
beam.define(Offscreen2DCommand)
window.beam = beam
const lightingShader = beam.shader(LambertLighting)
const imageShader = beam.shader(BasicImage)

const cameraMats = createCamera({ eye: [0, 0, 50] }, { canvas })
const matrices = beam.resource(Uniforms, cameraMats)
const light = beam.resource(Uniforms)
light.set('dirLight.direction', [0, 0, 1])

const ball = createBall()
const rect = createRect([0, 0, -3], 1, 5)
const graphics = mergeGraphics(ball, rect)
const graphicsBuffers = [
  beam.resource(VertexBuffers, graphics.vertex),
  beam.resource(IndexBuffer, graphics.index)
]

const offscreenTarget = beam.resource(OffscreenTarget)
const textures = beam.resource(Textures)
textures.set('img', offscreenTarget)

// screen quad
const quad = createRect()
const quadBuffers = [
  beam.resource(VertexBuffers, quad.vertex),
  beam.resource(IndexBuffer, quad.index)
]

const render = () => {
  beam.clear()
  beam.offscreen2D(offscreenTarget, () => {
    // beam.clear() here will set wrong gl.viewport
    beam.draw(lightingShader, ...graphicsBuffers, matrices, light)
  })
  beam.draw(imageShader, ...quadBuffers, textures)

  // default draw to screen
  // beam.clear().draw(lightingShader, ...graphicsBuffers, matrices, light)
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
    matrices.set('modelMat', modelMat)
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
