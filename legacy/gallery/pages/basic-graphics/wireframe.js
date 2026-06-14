import { Beam, ResourceTypes } from '../../../src/index.js'
import {
  NormalColor, RedWireframe
} from '../../shaders/basic-graphics-shaders.js'
import { createBall, toWireframe } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
const { VertexBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const normal = beam.shader(NormalColor)
const wireframe = beam.shader(RedWireframe)
const cameraMats = createCamera({ eye: [0, 10, 10] })
const camera = beam.resource(Uniforms, cameraMats)

const ball = createBall([0, 0, 0], 1, 10, 10)
const ballData = beam.resource(VertexBuffers, ball.vertex)
const ballColorIndex = beam.resource(IndexBuffer, ball.index)
const ballWireframeIndex = beam.resource(IndexBuffer, toWireframe(ball.index))

beam
  .clear()
  .draw(normal, ballData, ballColorIndex, camera)
  .draw(wireframe, ballData, ballWireframeIndex, camera)
