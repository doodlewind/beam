/* eslint-env browser */

import { Beam, ResourceTypes } from '../../../src/index.js'
import { LambertLighting } from '../../shaders/basic-lighting-shader.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create, rotate } from '../../utils/mat4.js'
const { VertexBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas)
const shader = beam.shader(LambertLighting)
const cameraMats = createCamera({ eye: [0, 6, 6] }, { canvas })
const matrices = beam.resource(Uniforms, cameraMats)
const light = beam.resource(Uniforms)
const ball = createBall()
const buffers = [
  beam.resource(VertexBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index)
]

const render = () => beam.clear().draw(shader, ...buffers, matrices, light)
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
