/* eslint-env browser */
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

const resources = [
  beam.resource(DataBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index),
  beam.resource(Uniforms, camera)
]

let i = 0; let delta
const tick = () => {
  i += 0.02; delta = 10 + Math.sin(i) * 5
  camera.viewMat = createCamera({ eye: [0, delta, delta] }).viewMat

  beam.clear().draw(plugin, ...resources)
  requestAnimationFrame(tick)
}
tick()
