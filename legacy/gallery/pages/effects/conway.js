/* eslint-env browser */
import { Beam, ResourceTypes, GLTypes } from '../../../src/index.js'
import { ConwayLifeGame } from './conway-shader.js'
import { BasicImage } from '../../shaders/image-filter-shaders.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const { VertexBuffers, IndexBuffer, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const conwayShader = beam.shader(ConwayLifeGame)
const imageShader = beam.shader(BasicImage)

const quad = createRect()
const quadBuffers = [
  beam.resource(VertexBuffers, quad.vertex),
  beam.resource(IndexBuffer, quad.index),
]

const conwayTextures = beam.resource(Textures)
const screenTextures = beam.resource(Textures)

const targetA = beam.target(2048, 2048)
const targetB = beam.target(2048, 2048)

const inputCanvas = document.createElement('canvas')
const ctx = inputCanvas.getContext('2d')
const size = 2048
inputCanvas.width = size
inputCanvas.height = size

const initRandomInput = () => {
  if (i % 2 !== 0) render() // Prevent drawing to same texture
  ctx.clearRect(0, 0, size, size)
  ctx.fillStyle = 'white'
  for (let i = 0; i < 50000; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 1, 1)
  }

  conwayTextures.set('state', { image: inputCanvas })
  initRender()
}

const initImageInput = (name) => {
  loadImages('../../assets/images/conway/' + name).then(([image]) => {
    if (i % 2 !== 0) render()
    const x = Math.floor((size - image.width) * 0.5)
    const y = Math.floor((size - image.height) * 0.5)
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(image, x, y)

    conwayTextures.set('state', { image: inputCanvas })
    initRender()
  })
}

let i = 0
let timer

const initRender = () => {
  cancelAnimationFrame(timer)
  conwayTextures.set('state', {
    magFilter: GLTypes.Nearest,
    minFilter: GLTypes.Nearest,
    flip: true,
  })

  beam.clear()
  targetA.use(() => {
    beam.draw(conwayShader, ...quadBuffers, conwayTextures)
  })

  tick()
}

const render = () => {
  const targetFrom = i % 2 === 0 ? targetA : targetB
  const targetTo = i % 2 === 0 ? targetB : targetA

  beam.clear()

  targetTo.use(() => {
    conwayTextures.set('state', targetFrom.texture)
    beam.draw(conwayShader, ...quadBuffers, conwayTextures)
  })
  screenTextures.set('img', targetTo.texture)

  beam.draw(imageShader, ...quadBuffers, screenTextures)
  i++
}
const tick = () => {
  render()
  timer = requestAnimationFrame(tick)
}

const $patternSelect = document.getElementById('pattern-select')
$patternSelect.addEventListener('change', () => {
  const name = $patternSelect.value
  if (name === 'random') initRandomInput()
  else initImageInput(name)
})

initImageInput('oscillators.png')
