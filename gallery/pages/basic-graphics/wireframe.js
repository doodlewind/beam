import { Beam, ResourceTypes } from '../../../src/index.js'
import {
  NormalGraphics, WireframeGraphics
} from '../../plugins/basic-graphics-plugins.js'
import { createBall, toWireframe } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const normal = beam.plugin(NormalGraphics)
const wireframe = beam.plugin(WireframeGraphics)
const camera = createCamera({ eye: [0, 10, 10] }, { canvas })
const cameraResource = beam.resource(Uniforms, camera)

const ball = createBall([0, 0, 0], 1, 10, 10)
const data = beam.resource(DataBuffers, ball.data)
const defaultIndex = beam.resource(IndexBuffer, ball.index)
const wireframeIndex = beam.resource(IndexBuffer, toWireframe(ball.index))

beam
  .clear()
  .draw(normal, data, defaultIndex, cameraResource)
  .draw(wireframe, data, wireframeIndex, cameraResource)
