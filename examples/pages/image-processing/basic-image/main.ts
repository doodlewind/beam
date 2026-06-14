import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import wgsl from './image.wgsl?raw'
import { createRect } from '../../../shared/geometry'
import { loadBitmap } from '../../../shared/image-loader'

const canvas = document.querySelector('canvas')!

const beam = await Beam.gpu(canvas)

// Pipeline = WGSL + schemas. No depth: it's a flat screen quad.
const quad = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})

const image = await loadBitmap(asset('/assets/images/prague.jpg'))

// Size the canvas to the image aspect, then fill it with a unit quad. The quad
// spans NDC [-1,1] in x and y (no projection), so the picture is never stretched.
const aspectRatio = image.width / image.height
canvas.width = 400 * aspectRatio
canvas.height = 400
const rect = createRect()

const verts = beam.verts(quad.schema.vertex, rect.vertex)
const index = beam.index(rect.index)
const tex = beam.texture(image, { srgb: true, flipY: true })
const samp = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })

beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(quad, {
    verts,
    index,
    textures: { img: tex },
    samplers: { samp },
  })
})
