import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import type { Wrap, Filter } from 'beam-gpu'
import wgsl from './texture-config.wgsl?raw'
import { createRect } from '../../../shared/geometry'
import { loadBitmap } from '../../../shared/image-loader'
import { Pane } from 'tweakpane'

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

// Sampler config lives in this mutable params object; the sampler is immutable,
// so each change rebuilds it. The texture's flipY is set when we (re)upload.
const params = {
  wrap: 'repeat' as Wrap,
  mag: 'linear' as Filter,
  min: 'linear' as Filter,
  flipY: true,
  scale: 1,
}

const img = beam.texture()
let samp = beam.sampler({ wrap: params.wrap, mag: params.mag, min: params.min })

const upload = (image: ImageBitmap) =>
  img.set(image, { flipY: params.flipY, mips: true })

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

const rebuildSampler = () => {
  samp = beam.sampler({ wrap: params.wrap, mag: params.mag, min: params.min })
  render()
}

const pane = new Pane({ title: 'Controls' })

const sampler = pane.addFolder({ title: 'Sampler' })
sampler
  .addBinding(params, 'wrap', {
    options: {
      Repeat: 'repeat',
      'Mirrored Repeat': 'mirror',
      'Clamp to Edge': 'clamp',
    },
  })
  .on('change', rebuildSampler)
sampler
  .addBinding(params, 'mag', {
    label: 'Mag Filter',
    options: { Linear: 'linear', Nearest: 'nearest' },
  })
  .on('change', rebuildSampler)
sampler
  .addBinding(params, 'min', {
    label: 'Min Filter',
    options: { Linear: 'linear', Nearest: 'nearest' },
  })
  .on('change', rebuildSampler)

const texture = pane.addFolder({ title: 'Texture' })
texture.addBinding(params, 'flipY', { label: 'Flip Y' }).on('change', () => {
  upload(image)
  render()
})
texture
  .addBinding(params, 'scale', { min: 0.05, max: 6, step: 0.01 })
  .on('change', () => {
    uniforms.set('scale', params.scale)
    render()
  })
