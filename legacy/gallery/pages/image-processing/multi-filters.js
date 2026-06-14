import { Beam, ResourceTypes } from '../../../src/index.js'
import {
  BrightnessContrast,
  HueSaturation,
  Vignette,
} from '../../shaders/image-filter-shaders.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const { VertexBuffers, IndexBuffer, Textures, Uniforms } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const brightnessContrast = beam.shader(BrightnessContrast)
const hueSaturation = beam.shader(HueSaturation)
const vignette = beam.shader(Vignette)

// Fill screen with unit quad
const quad = createRect()
const quadBuffers = [
  beam.resource(VertexBuffers, quad.vertex),
  beam.resource(IndexBuffer, quad.index),
]
const filterOptions = beam.resource(Uniforms)

let image

const base = '../../assets/images/'
const updateImage = (name) =>
  loadImages(base + name).then(([_image]) => {
    image = _image
    const aspectRatio = image.naturalWidth / image.naturalHeight
    canvas.height = 400
    canvas.width = 400 * aspectRatio
  })

// Input image texture resource
const inputTextures = beam.resource(Textures)
// Output texture resources
const textures = beam.resource(Textures)
// Offscreen FBO resources
const targets = [beam.target(128, 128), beam.target(128, 128)]

const baseResources = [...quadBuffers, filterOptions]
const render = () => {
  beam.clear()

  // Draw brightness contrast shader with original input
  targets[0].use(() => {
    beam.draw(brightnessContrast, inputTextures, ...baseResources)
  })
  textures.set('img', targets[0].texture)

  // Draw hue saturation shader with output from previous step
  targets[1].use(() => {
    beam.draw(hueSaturation, textures, ...baseResources)
  })
  textures.set('img', targets[1].texture)

  // Draw vignette shader to screen with outout from previous step
  beam.draw(vignette, textures, ...baseResources)
}

updateImage('prague.jpg').then(() => {
  inputTextures.set('img', { image, flip: true })
  // test target.resize
  targets[0].resize(image.naturalWidth, image.naturalHeight)
  targets[1].resize(image.naturalWidth, image.naturalHeight)
  render()
})

const $imageSelect = document.getElementById('image-select')
$imageSelect.addEventListener('change', () => {
  updateImage($imageSelect.value).then(() => {
    inputTextures.set('img', { image, flip: true })
    render()
  })
})

const fields = ['brightness', 'contrast', 'hue', 'saturation', 'vignette']
fields.forEach((field) => {
  const $field = document.getElementById(field)
  $field.addEventListener('input', () => {
    filterOptions.set(field, $field.value)
    render()
  })
})
