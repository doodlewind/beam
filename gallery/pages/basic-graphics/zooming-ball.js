/* eslint-env browser */
import { Beam, ResourceTypes } from '../../../src/index.js'
import { NormalColor } from '../../plugins/basic-graphics-plugins.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(NormalColor)
const ball = createBall()
const buffers = [
  beam.resource(DataBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index)
]
const cameraMats = createCamera({ eye: [0, 10, 10] }, { canvas })
let camera = beam.resource(Uniforms, cameraMats)

let i = 0; let d = 10
const tick = () => {
  i += 0.02; d = 10 + Math.sin(i) * 5
  const { viewMat } = createCamera({ eye: [0, d, d] })
  // Perform update:
  camera.set('viewMat', viewMat)

  // Or perform update with new resourse:
  // cameraMats.viewMat = viewMat
  // camera = beam.resource(Uniforms, cameraMats)

  beam.clear().draw(plugin, ...buffers, camera)
  requestAnimationFrame(tick)
}
tick()
