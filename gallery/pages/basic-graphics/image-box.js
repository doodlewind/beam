import { Beam, ResourceTypes } from '../../../src/index.js'
import { ImageColor } from '../../plugins/basic-graphics-plugins.js'
import { createBox } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const shader = beam.shader(ImageColor)
const cameraMats = createCamera({ eye: [10, 10, 10] }, { canvas })
const box = createBox()

loadImages('../../assets/images/prague.jpg').then(([image]) => {
  const imageState = { image, flip: true }
  beam.clear().draw(
    shader,
    beam.resource(DataBuffers, box.data),
    beam.resource(IndexBuffer, box.index),
    beam.resource(Uniforms, cameraMats),
    // The 'img' key is defined for the ImageColor plugin
    beam.resource(Textures, { img: imageState })
  )
})
