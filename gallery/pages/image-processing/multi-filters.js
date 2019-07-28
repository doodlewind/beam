import { Beam, ResourceTypes, Offscreen2DCommand } from '../../../src/index.js'
import {
  BrightnessContrast, HueSaturation, Vignette
} from '../../plugins/image-filter-plugins.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const {
  DataBuffers, IndexBuffer, Textures, Uniforms, Offscreen
} = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)
beam.define(Offscreen2DCommand)

const brightnessContrast = beam.plugin(BrightnessContrast)
const hueSaturation = beam.plugin(HueSaturation)
const vignette = beam.plugin(Vignette)

const rect = createRect()
const dataResource = beam.resource(DataBuffers, rect.data)
const indexResource = beam.resource(IndexBuffer, rect.index)
const argsResource = beam.resource(Uniforms)

let image

const base = '../../assets/images/'
const updateImage = name => loadImages(base + name).then(([_image]) => {
  image = _image
  const aspectRatio = image.naturalWidth / image.naturalHeight
  canvas.height = 400
  canvas.width = 400 * aspectRatio
})

// Different shade plugins
const plugins = [brightnessContrast, hueSaturation, vignette]
// Input image textures
const chain = [
  beam.resource(Textures), beam.resource(Textures), beam.resource(Textures)
]
// Offscreen cache objects
const caches = [beam.resource(Offscreen), beam.resource(Offscreen)]

const resources = [dataResource, indexResource, argsResource]
const draw = (plugin, input) => beam.draw(plugin, ...[...resources, input])
const render = () => {
  beam.clear()
  chain[0].set('img', { image, flip: true })
  // Draw to caches[0] with chain[0] as input
  beam.offscreen2D(caches[0], () => {
    draw(plugins[0], chain[0])
  })
  // Draw to caches[1] with chain[1] as input
  chain[1].set('img', caches[0])
  beam.offscreen2D(caches[1], () => {
    draw(plugins[1], chain[1])
  })
  // Draw to screen with caches[1] as input
  chain[2].set('img', caches[1])
  draw(plugins[2], chain[2])
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
