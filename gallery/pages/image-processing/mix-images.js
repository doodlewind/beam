import { Beam, ResourceTypes } from '../../../src/index.js'
import { MixImage } from './mix-image-shader.js'
import { createRect } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { loadImages } from '../../utils/image-loader.js'
const { VertexBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)

const shader = beam.shader(MixImage)
const cameraMats = createCamera({ eye: [0, 0, 5] }, { canvas })
// Fill screen unit quad
const quad = createRect()

// Mask the logo with the black hole's red channel
const render = ([imageA, imageB]) => {
  const imageStates = {
    img0: { image: imageA, flip: true },
    img1: { image: imageB, flip: true }
  }

  beam.clear().draw(
    shader,
    beam.resource(VertexBuffers, quad.vertex),
    beam.resource(IndexBuffer, quad.index),
    beam.resource(Uniforms, cameraMats),
    beam.resource(Textures, imageStates)
  )
}

const base = '../../assets/images/'
loadImages(base + 'html5-logo.svg', base + 'black-hole.jpg').then(render)
