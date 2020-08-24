/* eslint-env browser */
import {
  Beam, ResourceTypes, GLTypes, Offscreen2DCommand
} from '../../../src/index.js'
import { ConwayLifeGame } from './conway-shader.js'
import { BasicImage } from '../../shaders/image-filter-shaders.js'
import { createRect } from '../../utils/graphics-utils.js'
import { loadImages } from '../../utils/image-loader.js'
const { VertexBuffers, IndexBuffer, Textures, OffscreenTarget } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)
beam.define(Offscreen2DCommand)

const conwayShader = beam.shader(ConwayLifeGame)
const imageShader = beam.shader(BasicImage)

const quad = createRect()
const quadBuffers = [
  beam.resource(VertexBuffers, quad.vertex),
  beam.resource(IndexBuffer, quad.index)
]

const conwayTexture = beam.resource(Textures)
const screenTexture = beam.resource(Textures)

const targetA = beam.resource(OffscreenTarget)
const targetB = beam.resource(OffscreenTarget)

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

  conwayTexture.set('state', { image: inputCanvas })
  initRender()
}

const initImageInput = (name) => {
  loadImages('../../assets/images/conway/' + name).then(([image]) => {
    if (i % 2 !== 0) render()
    const x = Math.floor((size - image.width) * 0.5)
    const y = Math.floor((size - image.height) * 0.5)
    ctx.clearRect(0, 0, size, size)
    ctx.drawImage(image, x, y)

    conwayTexture.set('state', { image: inputCanvas })
    initRender()
  })
}

let i = 0; let timer

const initRender = () => {
  cancelAnimationFrame(timer)
  conwayTexture.set('state', {
    magFilter: GLTypes.Nearest,
    minFilter: GLTypes.Nearest,
    flip: true
  })

  beam.clear()
  beam.offscreen2D(targetA, () => {
    beam.draw(conwayShader, ...quadBuffers, conwayTexture)
  })
  const screenTexture = beam.resource(Textures)
  screenTexture.set('img', targetA)
  tick()
}

const render = () => {
  const targetFrom = i % 2 === 0 ? targetA : targetB
  const targetTo = i % 2 === 0 ? targetB : targetA

  beam.clear()
  beam.offscreen2D(targetTo, () => {
    conwayTexture.set('state', targetFrom)
    beam.draw(conwayShader, ...quadBuffers, conwayTexture)
  })

  screenTexture.set('img', targetTo)
  beam.draw(imageShader, ...quadBuffers, screenTexture)
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
