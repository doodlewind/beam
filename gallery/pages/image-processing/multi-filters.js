import { Beam, ResourceTypes, Pass2DCommand } from '../../../src/index.js'
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
beam.define(Pass2DCommand)

const brightnessContrast = beam.plugin(BrightnessContrast)
const hueSaturation = beam.plugin(HueSaturation)
const vignette = beam.plugin(Vignette)

const rect = createRect()
const dataResource = beam.resource(DataBuffers, rect.data)
const indexResource = beam.resource(IndexBuffer, rect.index)
const argsResource = beam.resource(Uniforms)
const offscreenA = beam.resource(Offscreen)
const offscreenB = beam.resource(Offscreen)

let inputImage

const base = '../../assets/images/'
const updateImage = name => loadImages(base + name).then(([image]) => {
  inputImage = image
  const aspectRatio = image.naturalWidth / image.naturalHeight
  canvas.height = 400
  canvas.width = 400 * aspectRatio
})

const render = () => {
  const imageState = { img: { image: inputImage, flip: true } }
  const imageResource = beam.resource(Textures, imageState) // FIXME

  const resources = [dataResource, indexResource, argsResource, imageResource]

  beam.clear()
  imageResource.set('img', { image: inputImage, flip: true })
  beam.pass2D(offscreenA, () => {
    beam.draw(brightnessContrast, ...resources)
  })
  imageResource.set('img', offscreenA)
  beam.pass2D(offscreenB, () => {
    beam.draw(hueSaturation, ...resources)
  })
  imageResource.set('img', offscreenB)
  beam.draw(vignette, ...resources)
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
