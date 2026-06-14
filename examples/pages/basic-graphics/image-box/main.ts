import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import wgsl from './image.wgsl?raw'
import { createCamera } from '../../../shared/camera'
import { identity, create } from '../../../shared/mat4'
import { createBox } from '../../../shared/geometry'
import { loadBitmap } from '../../../shared/image-loader'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', normal: 'vec3', texCoord: 'vec2' },
  uniforms: { modelMat: 'mat4', viewMat: 'mat4', projectionMat: 'mat4' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
  depth: true,
  cull: 'back',
})

const box = createBox()
const verts = beam.verts(pipe.schema.vertex, box.vertex)
const index = beam.index(box.index)

const modelMat = identity(create())
const { viewMat, projectionMat } = createCamera(
  { eye: [10, 10, 10] },
  { canvas }
)
const uniforms = beam.uniforms(pipe.schema.uniforms, {
  modelMat,
  viewMat,
  projectionMat,
})

const sampler = beam.sampler({ min: 'linear', mag: 'linear' })

const bitmap = await loadBitmap(asset('/assets/images/prague.jpg'))
const texture = beam.texture(bitmap, { flipY: true })

beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(pipe, {
    verts,
    index,
    uniforms,
    textures: { img: texture },
    samplers: { samp: sampler },
  })
})
