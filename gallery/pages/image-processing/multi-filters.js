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

// Input image texture resource
const input = beam.resource(Textures)
// Output texture resources
const outputResources = [beam.resource(Textures), beam.resource(Textures)]
// Offscreen FBO resources
const offscreens = [beam.resource(Offscreen), beam.resource(Offscreen)]

outputResources[0].set('img', offscreens[0])
outputResources[1].set('img', offscreens[1])

const resources = [dataResource, indexResource, argsResource]
const draw = (plugin, input) => beam.draw(plugin, ...[...resources, input])
const render = () => {
  beam.clear()
  input.set('img', { image, flip: true })
  beam
    // Draw brightness contrast shader with original input
    .offscreen2D(offscreens[0], () => draw(brightnessContrast, input))
    // Draw hue saturation shader with output from previous step
    .offscreen2D(offscreens[1], () => draw(hueSaturation, outputResources[0]))
  // Draw vignette shader to screen with outout from previous step
  draw(vignette, outputResources[1])
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
