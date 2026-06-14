import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import wgsl from './explode.wgsl?raw'
import { createCamera } from '../../../shared/camera'
import { loadBitmap } from '../../../shared/image-loader'

const canvas = document.querySelector('canvas')!
canvas.width = canvas.height = 800

const beam = await Beam.gpu(canvas)

const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec2', center: 'vec2', texCoord: 'vec2' },
  uniforms: {
    viewMat: 'mat4',
    projectionMat: 'mat4',
    progress: 'f32',
    aspectRatio: 'f32',
  },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})

// A grid of n*n quads (4 verts, 2 tris each). Each quad explodes outward along
// a per-quad direction derived from its center.
const createParticles = (n: number) => {
  const position: number[] = []
  const center: number[] = []
  const texCoord: number[] = []
  const index: number[] = []
  const h = 0.5
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x0 = i / n
      const x1 = (i + 1) / n
      const y0 = j / n
      const y1 = (j + 1) / n
      const xC = (x0 + x1) / 2
      const yC = (y0 + y1) / 2
      position.push(
        x0 - h,
        y0 - h,
        x1 - h,
        y0 - h,
        x1 - h,
        y1 - h,
        x0 - h,
        y1 - h
      )
      texCoord.push(x0, y0, x1, y0, x1, y1, x0, y1)
      for (let k = 0; k < 4; k++) center.push(xC - h, yC - h)
      const base = (i * n + j) * 4
      index.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }
  return { position, center, texCoord, index }
}

const { position, center, texCoord, index } = createParticles(100)
const verts = beam.verts(pipe.schema.vertex, { position, center, texCoord })
const idx = beam.index({ array: new Uint32Array(index) })

const { viewMat, projectionMat } = createCamera(
  { eye: [0, 0, 8] },
  { canvas, fov: Math.PI / 4 }
)

const image = await loadBitmap(asset('/assets/images/prague.jpg'))
const tex = beam.texture(image, { srgb: true, flipY: true })
const samp = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })

const uniforms = beam.uniforms(pipe.schema.uniforms, {
  viewMat,
  projectionMat,
  aspectRatio: image.width / image.height,
  progress: 0,
})

// progress oscillates 0 -> 2*SCALE -> 0: assemble, explode, reassemble.
// `t` is in ms; scale to ~1.2 rad/s to match the original's slow cycle.
const SCALE = 8
beam.loop((t) => {
  const time = t * 0.0012
  uniforms.set('progress', (Math.sin(time - Math.PI / 2) + 1) * SCALE)
  beam.clear([0, 0, 0, 1]).draw(pipe, {
    verts,
    index: idx,
    uniforms,
    textures: { img: tex },
    samplers: { samp },
  })
})
