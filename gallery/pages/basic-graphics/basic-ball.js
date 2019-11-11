import { Beam, ResourceTypes } from '../../../src/index.js'
import { NormalColor } from '../../plugins/basic-graphics-plugins.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const shader = beam.shader(NormalColor)
const cameraMats = createCamera({ eye: [0, 10, 10] }, { canvas })
const ball = createBall()

beam.clear().draw(
  shader,
  beam.resource(DataBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index),
  beam.resource(Uniforms, cameraMats)
)
