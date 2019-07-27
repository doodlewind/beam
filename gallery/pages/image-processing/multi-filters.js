import { Beam, ResourceTypes } from '../../../src/index.js'
import {
  BrightnessContrast, HueSaturation, Vignette
} from '../../plugins/image-filter-plugins.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Textures, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const brightnessContrast = beam.plugin(BrightnessContrast)
const hueSaturation = beam.plugin(HueSaturation)
const vignette = beam.plugin(Vignette)

const rect = createRect()
const dataResource = beam.resource(DataBuffers, rect.data)
const indexResource = beam.resource(IndexBuffer, rect.index)
const argsResource = beam.resource(Uniforms, {})
let imageResource

const base = '../../assets/images/'
const updateImage = name => loadImages(base + name).then(([image]) => {
  const aspectRatio = image.naturalWidth / image.naturalHeight
  canvas.height = 400
  canvas.width = 400 * aspectRatio
  imageResource = beam.resource(Textures, { img: { image, flip: true } })
})

const render = () => {
  const resources = [dataResource, indexResource, argsResource, imageResource]
  const plugin = brightnessContrast || hueSaturation || vignette // FIXME
  beam.clear().draw(plugin, ...resources)
}

updateImage('ivan.jpg').then(render)

const $imageSelect = document.getElementById('image-select')
$imageSelect.addEventListener('change', () => {
  updateImage($imageSelect.value).then(render)
})

const fields = ['brightness', 'contrast', 'hue', 'saturation', 'vignette']
fields.forEach(field => {
  const $field = document.getElementById(field)
  $field.addEventListener('input', () => {
    argsResource.set(field, $field.value)
    render()
  })
})
