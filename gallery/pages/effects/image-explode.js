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
const cameraMats = createCamera({ eye: [0, 0, 8] }, { canvas })
const options = beam.resource(Uniforms, cameraMats)
const textures = beam.resource(Textures)

let i = 0
const tick = () => {
  options.set('iTime', i)
  i += 0.05

  beam.clear([0, 0, 0, 1]).draw(plugin, ...buffers, options, textures)

  // requestAnimationFrame(tick) // for debug, comment this out
}

loadImages('../../assets/images/ivan.jpg').then(([image]) => {
  const aspectRatio = image.width / image.height

  const particles = createParticles(100, aspectRatio)
  buffers[0] = beam.resource(DataBuffers, particles.data)
  buffers[1] = beam.resource(IndexBuffer, particles.index)
  textures.set('img', { image, flip: true })
  tick()
})

const $pause = document.getElementById('pause')
$pause.addEventListener('click', () => {
  debugger // eslint-disable-line
})

const $groups = [0, 1, 2, 3].map(i => document.getElementById(`group-${i}`))
const $imageCount = document.getElementById('image-count')
$imageCount.addEventListener('input', () => {
  const count = parseInt($imageCount.value)
  for (let i = 0; i < 4; i++) $groups[i].hidden = (i >= count)
})
