import { Beam, ResourceTypes } from '../../../src/index.js'
import { OriginalImage } from '../../plugins/image-filter-plugins.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(OriginalImage)

// Fill screen with unit quad
const quad = createRect()
const quadBuffers = [
  beam.resource(DataBuffers, quad.data),
  beam.resource(IndexBuffer, quad.index)
]
let textures // TODO optimize with resourse setter

const updateImage = name => {
  loadImages('../../assets/images/' + name).then(([image]) => {
    const aspectRatio = image.naturalWidth / image.naturalHeight
    const imageState = { image, flip: true }
    canvas.height = 400
    canvas.width = 400 * aspectRatio
    textures = beam.resource(Textures, { img: imageState })
    beam.clear().draw(plugin, ...quadBuffers, textures)
  })
}

const $imageSelect = document.getElementById('image-select')
$imageSelect.addEventListener('change', () => {
  updateImage($imageSelect.value)
})

updateImage('ivan.jpg')
