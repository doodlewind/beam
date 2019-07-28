import { Beam, ResourceTypes } from '../../../src/index.js'
import { ImageGraphics } from '../../plugins/basic-graphics-plugins.js'
import { createBox } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(ImageGraphics)
const camera = createCamera({ eye: [10, 10, 10] }, { canvas })
const box = createBox()

loadImages('../../assets/images/prague.jpg').then(([image]) => {
  const imageState = { img: { image, flip: true } }
  beam.clear().draw(
    plugin,
    beam.resource(DataBuffers, box.data),
    beam.resource(IndexBuffer, box.index),
    beam.resource(Uniforms, camera),
    beam.resource(Textures, imageState)
  )
})
