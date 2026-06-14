import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import wgsl from './mix.wgsl?raw'
import { createRect } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'
import { loadImages } from '../../../shared/image-loader'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

// Two textures (img0, img1) mixed in one shader; one sampler reused for both.
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { viewMat: 'mat4', projectionMat: 'mat4' },
  textures: { img0: 'tex2d', img1: 'tex2d' },
  samplers: { samp: 'sampler' },
})

// Fill-screen unit quad, viewed straight on.
const quad = createRect()
const verts = beam.verts(pipe.schema.vertex, quad.vertex)
const index = beam.index(quad.index)

const camera = createCamera({ eye: [0, 0, 5] }, { canvas })
const uniforms = beam.uniforms(pipe.schema.uniforms, camera)

const sampler = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })

// Mask the HTML5 logo with the black hole's red channel.
const base = asset('/assets/images/')
const [imageA, imageB] = await loadImages(
  base + 'html5-logo.svg',
  base + 'black-hole.jpg'
)
const img0 = beam.texture(imageA, { flipY: true })
const img1 = beam.texture(imageB, { flipY: true })

beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(pipe, {
    verts,
    index,
    uniforms,
    textures: { img0, img1 },
    samplers: { samp: sampler },
  })
})
