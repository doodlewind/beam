import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
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

await updateImage('prague.jpg')

const $imageSelect = document.getElementById(
  'image-select'
) as HTMLSelectElement
$imageSelect.addEventListener('change', () => updateImage($imageSelect.value))

const setters: Record<string, (v: number) => void> = {
  brightness: (v) => bcUniforms.set('brightness', v),
  contrast: (v) => bcUniforms.set('contrast', v),
  hue: (v) => hsUniforms.set('hue', v),
  saturation: (v) => hsUniforms.set('saturation', v),
  vignette: (v) => vgUniforms.set('vignette', v),
}
Object.keys(setters).forEach((field) => {
  const $field = document.getElementById(field) as HTMLInputElement
  $field.addEventListener('input', () => {
    setters[field](Number($field.value))
    render()
  })
})
