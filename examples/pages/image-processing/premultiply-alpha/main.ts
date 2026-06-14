import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import { Pane } from 'tweakpane'
import { createRect } from '../../../shared/geometry'
import { loadImage } from '../../../shared/image-loader'
import wgsl from './premultiply.wgsl?raw'

const canvas = document.querySelector('canvas')!

// `alpha: 'premultiplied'` makes the canvas composite over the HTML page
// background, so the shader must output premultiplied color to look right.
const beam = await Beam.gpu(canvas, { alpha: 'premultiplied' })

const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { premultiply: 'f32' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
  // The shader already outputs premultiplied color (rgb*a, a); writing it
  // straight (no blend) into a single transparent-cleared quad is correct.
  blend: 'none',
})

// Fill the screen with a unit quad.
const quad = createRect()
const verts = beam.verts(pipe.schema.vertex, quad.vertex)
const index = beam.index(quad.index)
const uniforms = beam.uniforms(pipe.schema.uniforms, { premultiply: 1 })

const image = await loadImage(asset('/assets/images/beam-logo.png'))
const aspectRatio = image.naturalWidth / image.naturalHeight
canvas.height = 300
canvas.width = canvas.height * aspectRatio

const tex = beam.texture(image, { flipY: true })
const samp = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })

const render = () =>
  beam.frame(() => {
    beam.clear([0, 0, 0, 0]).draw(pipe, {
      verts,
      index,
      uniforms,
      textures: { img: tex },
      samplers: { samp },
    })
  })

const params = { premultiply: true }

const pane = new Pane({ title: 'Controls' })
pane.addBinding(params, 'premultiply', { label: 'Premultiply Alpha' })
pane.on('change', () => {
  uniforms.set({ premultiply: params.premultiply ? 1 : 0 })
  render()
})

render()
