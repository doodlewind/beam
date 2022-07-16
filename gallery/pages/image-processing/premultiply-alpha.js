import { Beam, ResourceTypes } from '../../../src/index.js'
import { BasicImage } from '../../shaders/image-filter-shaders.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const { VertexBuffers, IndexBuffer, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const shader = beam.shader(BasicImage)

// Fill screen with unit quad
const quad = createRect()
const quadBuffers = [
  beam.resource(VertexBuffers, quad.vertex),
  beam.resource(IndexBuffer, quad.index),
]
const textures = beam.resource(Textures)

const [image] = await loadImages('../../assets/images/beam-logo.png')
const aspectRatio = image.naturalWidth / image.naturalHeight
canvas.height = 300
canvas.width = canvas.height * aspectRatio

const updateImage = (val) => {
  textures.set('img', { image, premultiplyAlpha: val, flip: true })
  beam.clear().draw(shader, ...quadBuffers, textures)
}

const $toggle = document.getElementById('toggle')
$toggle.addEventListener('change', () => updateImage($toggle.checked))

updateImage(true)
