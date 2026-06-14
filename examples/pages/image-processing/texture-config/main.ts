import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import type { Wrap, Filter } from 'beam-gpu'
import wgsl from './texture-config.wgsl?raw'
import { createRect } from '../../../shared/geometry'
import { loadBitmap } from '../../../shared/image-loader'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { scale: 'f32' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})

const quad = createRect()
const verts = beam.verts(pipe.schema.vertex, quad.vertex)
const index = beam.index(quad.index)
const uniforms = beam.uniforms(pipe.schema.uniforms, { scale: 1 })

// Sampler config lives in these mutable bits of state; the sampler is immutable,
// so each change rebuilds it. The texture's flipY is set when we (re)upload.
let wrap: Wrap = 'repeat'
let mag: Filter = 'linear'
let min: Filter = 'linear'
let flipY = true

const img = beam.texture()
let samp = beam.sampler({ wrap, mag, min })

const upload = (image: ImageBitmap) => img.set(image, { flipY, mips: true })

const render = () => {
  beam.frame(() => {
    beam.clear().draw(pipe, {
      verts,
      index,
      uniforms,
      textures: { img },
      samplers: { samp },
    })
  })
}

const image = await loadBitmap(asset('/assets/images/venus.jpg'))
upload(image)
render()

const $ = (id: string) =>
  document.getElementById(id) as HTMLInputElement | HTMLSelectElement

$('wrap-select').addEventListener('input', (e) => {
  wrap = (e.target as HTMLSelectElement).value as Wrap
  samp = beam.sampler({ wrap, mag, min })
  render()
})
$('mag-filter-select').addEventListener('input', (e) => {
  mag = (e.target as HTMLSelectElement).value as Filter
  samp = beam.sampler({ wrap, mag, min })
  render()
})
$('min-filter-select').addEventListener('input', (e) => {
  min = (e.target as HTMLSelectElement).value as Filter
  samp = beam.sampler({ wrap, mag, min })
  render()
})
$('flip-y').addEventListener('input', (e) => {
  flipY = (e.target as HTMLInputElement).checked
  upload(image)
  render()
})
$('scale').addEventListener('input', (e) => {
  uniforms.set('scale', parseFloat((e.target as HTMLInputElement).value))
  render()
})
