import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import { createRect } from '../../../shared/geometry'
import { loadImage } from '../../../shared/image-loader'
import conwayWgsl from './conway.wgsl?raw'
import displayWgsl from './display.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 1024
canvas.height = 1024

const beam = await Beam.gpu(canvas)

// Grid resolution — must match `size = 1.0 / 2048.0` in conway.wgsl.
const SIZE = 2048

// Step pipeline writes the next state; display pipeline blits it to screen.
const conway = beam.pipeline({
  wgsl: conwayWgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  textures: { state: 'tex2d' },
  samplers: { samp: 'sampler' },
})
const display = beam.pipeline({
  wgsl: displayWgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})

// Full-screen quad shared by both passes.
const quad = createRect()
const verts = beam.verts(conway.schema.vertex, quad.vertex)
const index = beam.index(quad.index)

// Cells are discrete: sample with nearest so neighbour lookups don't blur.
const nearest = beam.sampler({ wrap: 'clamp', min: 'nearest', mag: 'nearest' })
const linear = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })

// Ping-pong state targets, plus the seed texture for the first step.
const targetA = beam.target({ width: SIZE, height: SIZE })
const targetB = beam.target({ width: SIZE, height: SIZE })
const seed = beam.texture()

// Offscreen canvas used to rasterise the initial pattern into a texture.
const inputCanvas = document.createElement('canvas')
inputCanvas.width = SIZE
inputCanvas.height = SIZE
const ctx = inputCanvas.getContext('2d')!

let i = 0
let raf = 0

const render = () => {
  const from = i % 2 === 0 ? targetA : targetB
  const to = i % 2 === 0 ? targetB : targetA
  beam.frame(() => {
    // Advance: from -> to, sampling the previous state with nearest filtering.
    to.clear([0, 0, 0, 1]).draw(conway, {
      verts,
      index,
      textures: { state: from.color },
      samplers: { samp: nearest },
    })
    // Display the freshly computed state on screen.
    beam.clear([0, 0, 0, 1]).draw(display, {
      verts,
      index,
      textures: { img: to.color },
      samplers: { samp: linear },
    })
  })
  i++
  raf = requestAnimationFrame(render)
}

// Seed targetA from the offscreen canvas, then start the loop.
const start = () => {
  cancelAnimationFrame(raf)
  i = 0
  seed.set(inputCanvas, { flipY: true })
  beam.frame(() => {
    targetA.clear([0, 0, 0, 1]).draw(conway, {
      verts,
      index,
      textures: { state: seed },
      samplers: { samp: nearest },
    })
  })
  raf = requestAnimationFrame(render)
}

const initRandom = () => {
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = 'white'
  for (let n = 0; n < 50000; n++) {
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 1, 1)
  }
  start()
}

const initImage = async (name: string) => {
  const image = await loadImage(asset('/assets/images/conway/') + name)
  const x = Math.floor((SIZE - image.width) * 0.5)
  const y = Math.floor((SIZE - image.height) * 0.5)
  ctx.clearRect(0, 0, SIZE, SIZE)
  ctx.drawImage(image, x, y)
  start()
}

const $select = document.getElementById('pattern-select') as HTMLSelectElement
$select.addEventListener('change', () => {
  const name = $select.value
  if (name === 'random') initRandom()
  else initImage(name)
})

await initImage('oscillators.png')
