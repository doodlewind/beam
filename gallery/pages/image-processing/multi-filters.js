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
const inputResource = beam.resource(Textures)
const offscreenCaches = [beam.resource(Offscreen), beam.resource(Offscreen)]
const cacheResources = [beam.resource(Textures), beam.resource(Textures)]

let inputImage

const base = '../../assets/images/'
const updateImage = name => loadImages(base + name).then(([image]) => {
  inputImage = image
  const aspectRatio = image.naturalWidth / image.naturalHeight
  canvas.height = 400
  canvas.width = 400 * aspectRatio
})

const render = () => {
  const resources = [dataResource, indexResource, argsResource]

  beam.clear()
  inputResource.set('img', { image: inputImage, flip: true })
  beam.pass2D(offscreenCaches[0], () => {
    beam.draw(brightnessContrast, ...[...resources, inputResource])
  })
  cacheResources[0].set('img', offscreenCaches[0])
  beam.pass2D(offscreenCaches[1], () => {
    beam.draw(hueSaturation, ...[...resources, cacheResources[0]])
  })
  cacheResources[1].set('img', offscreenCaches[1])
  beam.draw(vignette, ...[...resources, cacheResources[1]])
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
