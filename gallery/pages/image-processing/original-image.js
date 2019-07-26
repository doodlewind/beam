import { Beam, ResourceTypes } from '../../../src/index.js'
import { OriginalImage } from '../../plugins/image-filter-plugins.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Textures } = ResourceTypes

const canvas = document.getElementById('gl-canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(OriginalImage)

let dataResource
let indexResource
let imageResource

const updateImage = name => {
  loadImages('../../assets/images/' + name).then(([image]) => {
    const aspectRatio = image.naturalWidth / image.naturalHeight
    canvas.height = 400
    canvas.width = 400 * aspectRatio
    const rect = createRect()
    dataResource = beam.resource(DataBuffers, rect.data)
    indexResource = beam.resource(IndexBuffer, rect.index)
    imageResource = beam.resource(Textures, { img: { image, flip: true } })

    beam.clear().draw(plugin, dataResource, indexResource, imageResource)
  })
}

const $imageSelect = document.getElementById('image-select')
$imageSelect.addEventListener('change', () => {
  updateImage($imageSelect.value)
})

updateImage('ivan.jpg')
