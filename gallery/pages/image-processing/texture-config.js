import { Beam, ResourceTypes } from '../../../src/index.js'
import { PolygonTexture } from './texture-config-plugin.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(PolygonTexture)
const quad = createRect()
const dataBuffers = beam.resource(DataBuffers, quad.data)
const indexBuffer = beam.resource(IndexBuffer, quad.index)
const textures = beam.resource(Textures)
const uniforms = beam.resource(Uniforms)

const render = () => {
  beam.clear().draw(plugin, dataBuffers, indexBuffer, uniforms, textures)
}

loadImages('../../assets/images/venus.jpg').then(([image]) => {
  textures.set('img', { image, flip: true })
  render()
})

const $scale = document.getElementById('scale')
$scale.addEventListener('input', () => {
  const scale = parseFloat($scale.value)
  uniforms.set('scale', scale)
  render()
})
