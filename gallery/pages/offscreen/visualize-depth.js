import { Beam, ResourceTypes, Offscreen2DCommand } from '../../../src/index.js'
import { LambertLighting } from '../../shaders/basic-lighting-shader.js'
import { InspectDepth } from './shadow-shaders.js'
import { createBall, createRect } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create, translate } from '../../utils/mat4.js'
const {
  DataBuffers, IndexBuffer, Uniforms, Textures, OffscreenTarget
} = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas)
beam.define(Offscreen2DCommand)
const lightingShader = beam.shader(LambertLighting)
const inspectDepthShader = beam.shader(InspectDepth)

const eye = [0, 50, 50]
const center = [10, 10, 0]

const cameraMats = createCamera(
  { eye, center }, { canvas, zNear: 0.1, zFar: 100 }
)
const matrices = beam.resource(Uniforms, cameraMats)
const light = beam.resource(Uniforms)
light.set('dirLight.direction', [1, 1, 1])

const ball = createBall()
const ballBuffers = [
  beam.resource(DataBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index)
]

const offscreenTarget = beam.resource(OffscreenTarget, { depth: true })
const textures = beam.resource(Textures)
textures.set('img', offscreenTarget)

// screen quad
const quad = createRect()
const quadBuffers = [
  beam.resource(DataBuffers, quad.data),
  beam.resource(IndexBuffer, quad.index)
]

const baseModelMat = create()

const drawBalls = () => {
  for (let i = 1; i < 10; i++) {
    for (let j = 1; j < 10; j++) {
      const modelMat = translate([], baseModelMat, [i * 2, j * 2, 0])
      matrices.set('modelMat', modelMat)
      beam.draw(lightingShader, ...ballBuffers, matrices, light)
    }
  }
}

const render = () => {
  beam.clear()
  beam.offscreen2D(offscreenTarget, drawBalls)

  const options = beam.resource(Uniforms, { nearPlane: 0.1, farPlane: 100 })
  beam.draw(inspectDepthShader, ...quadBuffers, textures, options)

  // default draw to screen
  // beam.clear(); drawBalls()
}

render()
