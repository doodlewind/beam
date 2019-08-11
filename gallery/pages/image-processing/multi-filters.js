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

// Fill screen with unit quad
const quad = createRect()
const quadBuffers = [
  beam.resource(DataBuffers, quad.data),
  beam.resource(IndexBuffer, quad.index)
]
const filterOptions = beam.resource(Uniforms)

let image

const base = '../../assets/images/'
const updateImage = name => loadImages(base + name).then(([_image]) => {
  image = _image
  const aspectRatio = image.naturalWidth / image.naturalHeight
  canvas.height = 400
  canvas.width = 400 * aspectRatio
})

// Input image texture resource
const inputTextures = beam.resource(Textures)
// Output texture resources
const outputTextures = [beam.resource(Textures), beam.resource(Textures)]
// Offscreen FBO resources
const offscreens = [beam.resource(Offscreen), beam.resource(Offscreen)]

// TODO better offscreen texture attach API
outputTextures[0].set('img', offscreens[0])
outputTextures[1].set('img', offscreens[1])

const baseResources = [...quadBuffers, filterOptions]
const draw = (plugin, input) => beam.draw(plugin, ...[...baseResources, input])
const render = () => {
  beam.clear()
  inputTextures.set('img', { image, flip: true })
  beam
    // Draw brightness contrast shader with original input
    .offscreen2D(offscreens[0], () => {
      draw(brightnessContrast, inputTextures)
    })
    // Draw hue saturation shader with output from previous step
    .offscreen2D(offscreens[1], () => {
      draw(hueSaturation, outputTextures[0])
    })
  // Draw vignette shader to screen with outout from previous step
  draw(vignette, outputTextures[1])
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
    filterOptions.set(field, $field.value)
    render()
  })
})
