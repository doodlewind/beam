/* eslint-env browser */
import { Beam, ResourceTypes } from '../../../src/index.js'
import { NormalGraphics } from '../../plugins/basic-graphics-plugins.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(NormalGraphics)
const ball = createBall()
const bufferResources = [
  beam.resource(DataBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index)
]
const camera = createCamera({ eye: [0, 10, 10] }, { canvas })
let cameraResource = beam.resource(Uniforms, camera)

let i = 0; let d = 10
const tick = () => {
  i += 0.02; d = 10 + Math.sin(i) * 5
  const { viewMat } = createCamera({ eye: [0, d, d] })
  // Perform update:
  cameraResource.set('viewMat', viewMat)

  // Or perform update with new resourse:
  // camera.viewMat = viewMat
  // cameraResource = beam.resource(Uniforms, camera)

  beam.clear().draw(plugin, ...bufferResources, cameraResource)
  requestAnimationFrame(tick)
}
tick()
