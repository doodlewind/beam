import { Beam, ResourceTypes } from '../../../src/index.js'
import { BasicImage } from '../../plugins/image-filter-plugins.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const shader = beam.shader(BasicImage)

// Fill screen with unit quad
const quad = createRect()
const quadBuffers = [
  beam.resource(DataBuffers, quad.data),
  beam.resource(IndexBuffer, quad.index)
]
const textures = beam.resource(Textures)

const updateImage = name => {
  loadImages('../../assets/images/' + name).then(([image]) => {
    const aspectRatio = image.naturalWidth / image.naturalHeight
    const imageState = { image, flip: true }
    canvas.height = 400
    canvas.width = 400 * aspectRatio
    textures.set('img', imageState)
    beam.clear().draw(shader, ...quadBuffers, textures)
  })
}

const $imageSelect = document.getElementById('image-select')
$imageSelect.addEventListener('change', () => {
  updateImage($imageSelect.value)
})

updateImage('ivan.jpg')
