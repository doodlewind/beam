/* eslint-env browser */
import { Beam, ResourceTypes } from '../../../src/index.js'
import { ImageExplode } from './explode-plugin.js'
import { createParticles } from './utils.js'
import { createCamera } from '../../utils/camera.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas)

const plugin = beam.plugin(ImageExplode)
const buffers = []
const cameraMats = createCamera({ eye: [0, 0, 5] }, { canvas })
const options = beam.resource(Uniforms, cameraMats)
const textures = beam.resource(Textures)

let i = 0
const tick = () => {
  options.set('iTime', i)
  i += 0.05

  beam.clear().draw(plugin, ...buffers, options, textures)
  requestAnimationFrame(tick) // for debug, comment this out
}

loadImages('../../assets/images/ivan.jpg').then(([image]) => {
  const aspectRatio = image.width / image.height

  const particles = createParticles(100, aspectRatio)
  buffers[0] = beam.resource(DataBuffers, particles.data)
  buffers[1] = beam.resource(IndexBuffer, particles.index)
  textures.set('img', { image, flip: true })
  tick()
})
