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
let plugin = brightnessContrast

// Fill screen with unit quad
const quad = createRect()
const quadBuffers = [
  beam.resource(DataBuffers, quad.data),
  beam.resource(IndexBuffer, quad.index)
]
const filterOptions = beam.resource(Uniforms)
const textures = beam.resource(Textures)

const base = '../../assets/images/'
const updateImage = name => loadImages(base + name).then(([image]) => {
  const imageState = { image, flip: true }
  const aspectRatio = image.naturalWidth / image.naturalHeight
  canvas.height = 400
  canvas.width = 400 * aspectRatio
  textures.set('img', imageState)
})

const render = () => {
  const resources = [...quadBuffers, filterOptions, textures]
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
    filterOptions.set(field, $field.value)
    render()
  })
})

const groups = ['brightness-contrast', 'hue-saturation', 'vignette']
const $controlGroups = groups.map(id => document.getElementById(id + '-group'))
const showControlGroup = name => {
  const $showGroup = $controlGroups[groups.indexOf(name)]
  $controlGroups.forEach($group => {
    $group.hidden = !($group === $showGroup)
  })
}
const $filterSelect = document.getElementById('filter-select')
$filterSelect.addEventListener('change', () => {
  const name = $filterSelect.value
  showControlGroup(name)
  plugin = {
    'brightness-contrast': brightnessContrast,
    'hue-saturation': hueSaturation,
    'vignette': vignette
  }[name]
  render()
})
