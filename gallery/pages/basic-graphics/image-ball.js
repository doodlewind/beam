import { Beam, ResourceTypes } from '../../../src/index.js'
import { ImageGraphics } from '../../plugins/basic-graphics-plugins.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.getElementById('gl-canvas')
const beam = new Beam(canvas)
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth

const plugin = beam.plugin(ImageGraphics)
const camera = createCamera({ eye: [0, 0, 10] }, { canvas })
const ball = createBall()

const render = ([image]) => {
  const imageState = { img: { image, flip: true } }

  beam.clear([1, 1, 1, 1]).draw(
    plugin,
    beam.resource(DataBuffers, ball.data),
    beam.resource(IndexBuffer, ball.index),
    beam.resource(Uniforms, camera),
    beam.resource(Textures, imageState)
  )
}

// loadImages('../../assets/images/gaoding.svg').then(render)
loadImages('../../assets/images/world-map.svg').then(render)
