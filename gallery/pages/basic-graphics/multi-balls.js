import { Beam, ResourceTypes } from '../../../src/index.js'
import { NormalGraphics } from '../../plugins/basic-graphics-plugins.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create, translate } from '../../utils/mat4.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(NormalGraphics)
const ball = createBall()
const bufferResources = [
  beam.resource(DataBuffers, ball.data),
  beam.resource(IndexBuffer, ball.index)
]
const camera = createCamera(
  // For center, use { eye: [10.5, 10.5, 50], center: [10.5, 10.5, 0] }
  { eye: [0, 50, 50], center: [10, 10, 0] }, { canvas }
)
const matrixResource = beam.resource(Uniforms, camera)
const baseMat = create()

const render = () => {
  beam.clear()
  for (let i = 1; i < 10; i++) {
    for (let j = 1; j < 10; j++) {
      const modelMat = translate([], baseMat, [i * 2, j * 2, 0])
      matrixResource.set('modelMat', modelMat)
      beam.draw(plugin, ...bufferResources, matrixResource)
    }
  }
}

render()
