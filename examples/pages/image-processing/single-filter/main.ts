import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import type { Pipeline } from 'beam-gpu'
import { createRect } from '../../../shared/geometry'
import { loadBitmap } from '../../../shared/image-loader'
import brightnessContrastWGSL from './brightness-contrast.wgsl?raw'
import hueSaturationWGSL from './hue-saturation.wgsl?raw'
import vignetteWGSL from './vignette.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

// A full-screen quad. The same vertex/index buffers feed every filter.
const quad = createRect()
const verts = beam.verts({ position: 'vec3', texCoord: 'vec2' }, quad.vertex)
const index = beam.index(quad.index)

// One pipeline per filter, each with its own uniforms resource.
const brightnessContrast = beam.pipeline({
  wgsl: brightnessContrastWGSL,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { brightness: 'f32', contrast: 'f32' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})
const hueSaturation = beam.pipeline({
  wgsl: hueSaturationWGSL,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { hue: 'f32', saturation: 'f32' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})
const vignette = beam.pipeline({
  wgsl: vignetteWGSL,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { vignette: 'f32' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})

const filters = {
  'brightness-contrast': {
    pipe: brightnessContrast,
    uniforms: beam.uniforms(brightnessContrast.schema.uniforms, {
      brightness: 0,
      contrast: 0,
    }),
  },
  'hue-saturation': {
    pipe: hueSaturation,
    uniforms: beam.uniforms(hueSaturation.schema.uniforms, {
      hue: 0,
      saturation: 0,
    }),
  },
  vignette: {
    pipe: vignette,
    uniforms: beam.uniforms(vignette.schema.uniforms, { vignette: 0 }),
  },
} as const
type FilterName = keyof typeof filters

let current: FilterName = 'brightness-contrast'

const sampler = beam.sampler({ min: 'linear', mag: 'linear', wrap: 'clamp' })
const img = beam.texture()

const render = () => {
  const { pipe, uniforms } = filters[current]
  beam.frame(() => {
    beam.clear([0, 0, 0, 1]).draw(pipe as Pipeline, {
      verts,
      index,
      uniforms,
      textures: { img },
      samplers: { samp: sampler },
    })
  })
}

const updateImage = async (name: string) => {
  const bitmap = await loadBitmap(asset('/assets/images/') + name)
  const aspectRatio = bitmap.width / bitmap.height
  beam.resize(400 * aspectRatio, 400)
  img.set(bitmap, { srgb: true, flipY: true })
  render()
}

await updateImage('prague.jpg')

const $imageSelect = document.getElementById(
  'image-select'
) as HTMLSelectElement
$imageSelect.addEventListener('change', () => updateImage($imageSelect.value))

// Live slider bindings. Each input writes its named uniform then redraws.
const fields = ['brightness', 'contrast', 'hue', 'saturation', 'vignette']
fields.forEach((field) => {
  const $field = document.getElementById(field) as HTMLInputElement
  $field.addEventListener('input', () => {
    filters[current].uniforms.set(field, Number($field.value))
    render()
  })
})

const groups = ['brightness-contrast', 'hue-saturation', 'vignette'] as const
const $groups = groups.map(
  (id) => document.getElementById(id + '-group') as HTMLDivElement
)
const $filterSelect = document.getElementById(
  'filter-select'
) as HTMLSelectElement
$filterSelect.addEventListener('change', () => {
  current = $filterSelect.value as FilterName
  $groups.forEach(($group, i) => {
    $group.hidden = groups[i] !== current
  })
  render()
})
