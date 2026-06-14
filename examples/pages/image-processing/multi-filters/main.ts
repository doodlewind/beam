import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import { Pane } from 'tweakpane'
import { createRect } from '../../../shared/geometry'
import { loadBitmap } from '../../../shared/image-loader'
import brightnessContrastWgsl from './brightness-contrast.wgsl?raw'
import hueSaturationWgsl from './hue-saturation.wgsl?raw'
import vignetteWgsl from './vignette.wgsl?raw'

const canvas = document.querySelector('canvas')!

const beam = await Beam.gpu(canvas)

// Three single-pass filters sharing the same full-screen-quad vertex schema.
const brightnessContrast = beam.pipeline({
  wgsl: brightnessContrastWgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { brightness: 'f32', contrast: 'f32' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})
const hueSaturation = beam.pipeline({
  wgsl: hueSaturationWgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { hue: 'f32', saturation: 'f32' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})
const vignette = beam.pipeline({
  wgsl: vignetteWgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { vignette: 'f32' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})

// Unit quad that fills clip space.
const quad = createRect()
const verts = beam.verts(brightnessContrast.schema.vertex, quad.vertex)
const index = beam.index(quad.index)

// Per-filter uniform values, driven by the range inputs.
const bcUniforms = beam.uniforms(brightnessContrast.schema.uniforms, {
  brightness: 0,
  contrast: 0,
})
const hsUniforms = beam.uniforms(hueSaturation.schema.uniforms, {
  hue: 0,
  saturation: 0,
})
const vgUniforms = beam.uniforms(vignette.schema.uniforms, { vignette: 0 })

const sampler = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })

// Input image + two ping-pong offscreen targets.
let inputTexture = beam.texture()
let targetA = beam.target({ width: 1, height: 1 })
let targetB = beam.target({ width: 1, height: 1 })

const render = () => {
  beam.frame(() => {
    // Pass 1: input image -> targetA with brightness/contrast.
    targetA.clear([0, 0, 0, 1]).draw(brightnessContrast, {
      verts,
      index,
      uniforms: bcUniforms,
      textures: { img: inputTexture },
      samplers: { samp: sampler },
    })
    // Pass 2: targetA -> targetB with hue/saturation.
    targetB.clear([0, 0, 0, 1]).draw(hueSaturation, {
      verts,
      index,
      uniforms: hsUniforms,
      textures: { img: targetA.color },
      samplers: { samp: sampler },
    })
    // Pass 3: targetB -> screen with vignette.
    beam.clear([0, 0, 0, 1]).draw(vignette, {
      verts,
      index,
      uniforms: vgUniforms,
      textures: { img: targetB.color },
      samplers: { samp: sampler },
    })
  })
}

const updateImage = async (name: string) => {
  const bitmap = await loadBitmap(asset('/assets/images/') + name)
  const aspectRatio = bitmap.width / bitmap.height
  canvas.height = 400
  canvas.width = 400 * aspectRatio
  beam.resize()
  inputTexture.set(bitmap, { flipY: true })
  targetA.resize(bitmap.width, bitmap.height)
  targetB.resize(bitmap.width, bitmap.height)
  render()
}

// Single state object holding every value the old controls drove.
const params = {
  image: 'prague.jpg',
  brightness: 0,
  contrast: 0,
  hue: 0,
  saturation: 0,
  vignette: 0,
}

await updateImage(params.image)

const pane = new Pane({ title: 'Controls' })

pane
  .addBinding(params, 'image', {
    label: 'Image',
    options: { Prague: 'prague.jpg', Jade: 'jade.jpg' },
  })
  .on('change', (ev) => {
    void updateImage(ev.value)
  })

const bcFolder = pane.addFolder({ title: 'Brightness / Contrast' })
bcFolder.addBinding(params, 'brightness', { min: -0.5, max: 0.5, step: 0.01 })
bcFolder.addBinding(params, 'contrast', { min: -0.3, max: 0.3, step: 0.01 })

const hsFolder = pane.addFolder({ title: 'Hue / Saturation' })
hsFolder.addBinding(params, 'hue', { min: -1, max: 1, step: 0.01 })
hsFolder.addBinding(params, 'saturation', { min: -0.5, max: 0.5, step: 0.005 })

const vgFolder = pane.addFolder({ title: 'Vignette' })
vgFolder.addBinding(params, 'vignette', { min: 0, max: 1, step: 0.005 })

// All sliders feed the uniforms, then re-render the static frame.
const updateFilters = () => {
  bcUniforms.set('brightness', params.brightness)
  bcUniforms.set('contrast', params.contrast)
  hsUniforms.set('hue', params.hue)
  hsUniforms.set('saturation', params.saturation)
  vgUniforms.set('vignette', params.vignette)
  render()
}
bcFolder.on('change', updateFilters)
hsFolder.on('change', updateFilters)
vgFolder.on('change', updateFilters)
