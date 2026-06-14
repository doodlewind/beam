import { Beam } from 'beam-gpu'
import wgsl from './normal.wgsl?raw'
import { createBall } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

// Normal-colored ball: vertex normals double as RGB. Depth on for solid 3D.
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', normal: 'vec3' },
  uniforms: { modelMat: 'mat4', viewMat: 'mat4', projectionMat: 'mat4' },
  depth: true,
})

const ball = createBall()
const verts = beam.verts(pipe.schema.vertex, ball.vertex)
const index = beam.index(ball.index)

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const { viewMat, projectionMat } = createCamera(
  { eye: [0, 10, 10] },
  { canvas }
)
const uniforms = beam.uniforms(pipe.schema.uniforms, {
  modelMat: identity,
  viewMat,
  projectionMat,
})

// Animate the camera distance each frame, recomputing viewMat from a new eye.
let i = 0
beam.loop(() => {
  i += 0.02
  const d = 10 + Math.sin(i) * 5
  const { viewMat } = createCamera({ eye: [0, d, d] }, { canvas })
  uniforms.set('viewMat', viewMat)

  beam.clear([0, 0, 0, 1]).draw(pipe, { verts, index, uniforms })
})
