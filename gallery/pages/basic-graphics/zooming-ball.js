/* eslint-env browser */
import { Beam, ResourceTypes } from '../../../src/index.js'
import { NormalColor } from '../../shaders/basic-graphics-shaders.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
const { VertexBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const shader = beam.shader(NormalColor)
const ball = createBall()
const buffers = [
  beam.resource(VertexBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index)
]
let i = 0; let d = 10
const cameraMats = createCamera({ eye: [0, d, d] })
let camera = beam.resource(Uniforms, cameraMats)

const tick = () => {
  i += 0.02; d = 10 + Math.sin(i) * 5
  const { viewMat } = createCamera({ eye: [0, d, d] })
  // Update uniform resource
  camera.set('viewMat', viewMat)

  // Or perform update with new resourse:
  // cameraMats.viewMat = viewMat
  // camera = beam.resource(Uniforms, cameraMats)

  beam.clear().draw(shader, ...buffers, camera)
  requestAnimationFrame(tick)
}
tick() // Begin render loop
