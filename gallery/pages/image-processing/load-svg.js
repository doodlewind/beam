import { Beam, ResourceTypes } from '../../../src/index.js'
import { ImageColor } from '../../shaders/basic-graphics-shaders.js'
import { createRect } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const shader = beam.shader(ImageColor)
const cameraMats = createCamera({ eye: [0, 0, 5] }, { canvas })

const render = ([image]) => {
  const imageState = { image, flip: true }
  const rect = createRect([0, 0, 0], image.height / image.width)

  beam.clear().draw(
    shader,
    beam.resource(DataBuffers, rect.data),
    beam.resource(IndexBuffer, rect.index),
    beam.resource(Uniforms, cameraMats),
    beam.resource(Textures, { img: imageState })
  )
}

loadImages('../../assets/images/gaoding.svg').then(render)
