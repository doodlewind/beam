import { Beam, ResourceTypes } from '../../../src/index.js'
import { NormalColor } from '../../shaders/basic-graphics-shaders.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
const { VertexBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const shader = beam.shader(NormalColor)
const cameraMats = createCamera({ eye: [0, 10, 10] })
const ball = createBall()

beam.clear().draw(
  shader,
  beam.resource(VertexBuffers, ball.vertex),
  beam.resource(IndexBuffer, ball.index),
  beam.resource(Uniforms, cameraMats)
)
