/* eslint-env browser */
import { Beam, ResourceTypes } from '../../../src/index.js'
import { ImageGraphics } from '../../plugins/basic-graphics-plugins.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { rotate } from '../../utils/mat4.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.getElementById('gl-canvas')
const beam = new Beam(canvas)
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth

const plugin = beam.plugin(ImageGraphics)
const eye = [0, 0, 10]
const baseViewMat = createCamera({ eye }).viewMat
const camera = createCamera({ eye }, { canvas })
const ball = createBall()
const dataResource = beam.resource(DataBuffers, ball.data)
const indexResource = beam.resource(IndexBuffer, ball.index)
const cameraResource = beam.resource(Uniforms, camera)

loadImages('../../assets/images/world-map.svg').then(([image]) => {
  const imageState = { img: { image, flip: true } }
  const imageResource = beam.resource(Textures, imageState)

  let i = 0
  const tick = () => {
    i += 0.02
    const viewMat = rotate([], baseViewMat, i, [0, 1, 0])
    cameraResource.set('viewMat', viewMat)
    beam.clear([1, 1, 1, 1]).draw(
      plugin, dataResource, indexResource, cameraResource, imageResource
    )
    requestAnimationFrame(tick)
  }
  tick()
})
