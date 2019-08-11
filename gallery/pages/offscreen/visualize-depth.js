import { Beam, ResourceTypes } from '../../../src/index.js'
import { LambertLighting } from '../../plugins/basic-lighting-plugin.js'
import { InspectDepth } from './shadow-plugins.js'
import { createBall, createRect } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create, translate } from '../../utils/mat4.js'
import { initOffscreen, Offscreen2DCommand } from './utils.js'
const {
  DataBuffers, IndexBuffer, Uniforms, Textures, OffscreenTarget
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
const lightingPlugin = beam.plugin(LambertLighting)
const inspectDepthPlugin = beam.plugin(InspectDepth)

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

const offscreenTarget = beam.resource(
  OffscreenTarget, { depth: true, init: initOffscreen }
)
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
      beam.draw(lightingPlugin, ...ballBuffers, matrices, light)
    }
  }
}

const render = () => {
  beam.clear()
  beam.offscreen2D(offscreenTarget, drawBalls)

  const options = beam.resource(Uniforms, { nearPlane: 0.1, farPlane: 100 })
  beam.draw(inspectDepthPlugin, ...quadBuffers, textures, options)

  // default draw to screen
  // beam.clear(); drawBalls()
}

render()
