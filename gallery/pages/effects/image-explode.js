/* eslint-env browser */
import { Beam, ResourceTypes } from '../../../src/index.js'
import { ImageExplode } from './explode-plugin.js'
import { createParticles, createAnimateStateGetter } from './explode-utils.js'
import { createCamera } from '../../utils/camera.js'
import { loadImages } from '../../utils/image-loader.js'
const { DataBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas)

const plugin = beam.plugin(ImageExplode)

const particles = createParticles(100)
const buffers = [
  beam.resource(DataBuffers, particles.data),
  beam.resource(IndexBuffer, particles.index)
]
const cameraMats = createCamera({ eye: [0, 0, 8] }, { canvas })
const options = beam.resource(Uniforms, cameraMats)
const textures = beam.resource(Textures)

let time = 0
const names = ['ivan.jpg', 'prague.jpg', 'xiaomi.jpg']
let images = []
let currentImage = null
let animateStateGetter = () => {}

const render = () => beam.clear().draw(plugin, ...buffers, options, textures)

const tick = () => {
  const { progress, image } = animateStateGetter(time)
  options
    .set('progress', progress)
    .set('aspectRatio', image.width / image.height)
  if (image !== currentImage) textures.set('img', { image, flip: true })
  currentImage = image
  time += 0.02

  render()
  requestAnimationFrame(tick) // for debug, comment this out
}

const $imagesSelects = [0, 1, 2]
  .map(i => document.getElementById(`image-select-${i}`))

const resetAnimation = () => {
  time = 0
  const count = parseInt($imageCount.value)
  const subImages = []
  for (let i = 0; i < count; i++) {
    const selecedName = $imagesSelects[i].value
    subImages.push(images[names.indexOf(selecedName)])
  }
  animateStateGetter = createAnimateStateGetter(subImages)
}

const main = () => {
  const paths = names.map(name => '../../assets/images/' + name)
  loadImages(...paths).then(_images => {
    images = _images
    resetAnimation()
    tick()
  })
}

main()

const $pause = document.getElementById('pause')
$pause.addEventListener('click', () => {
  debugger // eslint-disable-line
})

const $particleCount = document.getElementById('particle-count')
$particleCount.addEventListener('input', () => {
  const n = parseInt($particleCount.value)
  const { data, index } = createParticles(n)
  buffers[0]
    .set('position', data.position)
    .set('center', data.center)
    .set('texCoord', data.texCoord)
  buffers[1].set(index)

  resetAnimation()
})

const $groups = [0, 1, 2].map(i => document.getElementById(`group-${i}`))
const $imageCount = document.getElementById('image-count')
$imageCount.addEventListener('input', () => {
  const count = parseInt($imageCount.value)
  for (let i = 0; i < 3; i++) $groups[i].hidden = (i >= count)

  resetAnimation()
})

$imagesSelects.forEach($select => {
  $select.addEventListener('input', resetAnimation)
})
