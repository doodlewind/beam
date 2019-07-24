import { Beam, ResourceTypes } from '../../../src/index.js'
import { ImageGraphics } from '../../plugins/basic-graphics-plugins.js'
import { createRect } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.getElementById('gl-canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(ImageGraphics)
const camera = createCamera({ eye: [0, 0, 10] }, { canvas })
const rect = createRect()

const render = ([image]) => {
  const imageState = { img: { image, flip: true } }

  beam.clear().draw(
    plugin,
    beam.resource(DataBuffers, rect.data),
    beam.resource(IndexBuffer, rect.index),
    beam.resource(Uniforms, camera),
    beam.resource(Textures, imageState)
  )
}

loadImages('../../assets/images/black-hole.jpg').then(render)
