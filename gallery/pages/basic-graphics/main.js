import { Beam, ResourceTypes } from '../../../src/index.js'
import { NormalGraphics } from '../../plugins/graphics-plugins.js'
import { createBall } from '../../utils/shape-utils.js'
import { createCamera } from '../../utils/camera.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.getElementById('gl-canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(NormalGraphics)
const camera = createCamera({ eye: [0, 10, 10] }, { canvas })
const ball = createBall()

beam.clear().draw(
  plugin,
  beam.resource(DataBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index),
  beam.resource(Uniforms, camera)
)
