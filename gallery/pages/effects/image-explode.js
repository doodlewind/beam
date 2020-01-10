/* eslint-env browser */
import { Beam, ResourceTypes } from '../../../src/index.js'
import { ImageExplode } from './explode-shader.js'
import { createParticles, createAnimationStateGetter } from './explode-utils.js'
import { createCamera } from '../../utils/camera.js'
import { loadImages } from '../../utils/image-loader.js'
const { VertexBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas)

const shader = beam.shader(ImageExplode)

const particles = createParticles(100)
const buffers = [
  beam.resource(VertexBuffers, particles.vertex),
  beam.resource(IndexBuffer, particles.index)
]
const cameraMats = createCamera({ eye: [0, 0, 8] }, { canvas })
const uniforms = beam.resource(Uniforms, cameraMats)
const textures = beam.resource(Textures)

const names = ['ivan.jpg', 'prague.jpg', 'xiaomi.jpg']
let images = []
let time = 0
let currentImage = null
let animationStateGetter = () => {}

const render = () => beam.clear().draw(shader, ...buffers, uniforms, textures)

const tick = () => {
  // Query animation state for each frame, based on time
  const { progress, image } = animationStateGetter(time)

  // Update WebGL resources
  uniforms
    .set('progress', progress)
    .set('aspectRatio', image.width / image.height)
  if (image !== currentImage) textures.set('img', { image, flip: true })

  // Update "current" states
  currentImage = image
  time += 0.02

  render()
  requestAnimationFrame(tick) // for debug, comment this out
}

const $imagesSelects = [0, 1, 2]
  .map(i => document.getElementById(`image-select-${i}`))

const restartAnimation = () => {
  time = 0
  const count = parseInt($imageCount.value)
  const selectedImages = []
  for (let i = 0; i < count; i++) {
    const selecedName = $imagesSelects[i].value
    selectedImages.push(images[names.indexOf(selecedName)])
  }
  animationStateGetter = createAnimationStateGetter(selectedImages)
}

const main = () => {
  const paths = names.map(name => '../../assets/images/' + name)
  // Begin animation after all images are loaded
  loadImages(...paths).then(_images => {
    images = _images
    restartAnimation()
    tick()
  })
}

main()

document.getElementById('pause').addEventListener('click', () => {
  debugger // eslint-disable-line
})

const $particleCount = document.getElementById('particle-count')
$particleCount.addEventListener('change', () => {
  const n = parseInt($particleCount.value)
  const { vertex, index } = createParticles(n)
  buffers[0]
    .set('position', vertex.position)
    .set('center', vertex.center)
    .set('texCoord', vertex.texCoord)
  buffers[1].set(index)

  restartAnimation()
})

const $groups = [0, 1, 2].map(i => document.getElementById(`group-${i}`))
const $imageCount = document.getElementById('image-count')
$imageCount.addEventListener('input', () => {
  const count = parseInt($imageCount.value)
  for (let i = 0; i < 3; i++) $groups[i].hidden = (i >= count)

  restartAnimation()
})

$imagesSelects.forEach($select => {
  $select.addEventListener('input', restartAnimation)
})
