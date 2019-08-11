import { Beam, ResourceTypes } from '../../../src/index.js'
import {
  NormalColor, RedWireframe
} from '../../plugins/basic-graphics-plugins.js'
import { createBall, toWireframe } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const normal = beam.plugin(NormalColor)
const wireframe = beam.plugin(RedWireframe)
const cameraMats = createCamera({ eye: [0, 10, 10] }, { canvas })
const camera = beam.resource(Uniforms, cameraMats)

const ball = createBall([0, 0, 0], 1, 10, 10)
const ballData = beam.resource(DataBuffers, ball.data)
const ballColorIndex = beam.resource(IndexBuffer, ball.index)
const ballWireframeIndex = beam.resource(IndexBuffer, toWireframe(ball.index))

beam
  .clear()
  .draw(normal, ballData, ballColorIndex, camera)
  .draw(wireframe, ballData, ballWireframeIndex, camera)
