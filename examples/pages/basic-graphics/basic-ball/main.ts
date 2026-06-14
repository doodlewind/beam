import { Beam } from 'beam-gpu'
import { createBall } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'
import { identity } from '../../../shared/mat4'
import wgsl from './ball.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

// depth:true makes the ball solid (not see-through). cull:'none' avoids
// depending on a winding convention that could hide the whole ball.
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', normal: 'vec3' },
  uniforms: { modelMat: 'mat4', viewMat: 'mat4', projectionMat: 'mat4' },
  cull: 'none',
  depth: true,
})

const ball = createBall()
const verts = beam.verts(pipe.schema.vertex, ball.vertex)
const index = beam.index(ball.index)

const { viewMat, projectionMat } = createCamera(
  { eye: [0, 10, 10] },
  { canvas }
)
const uniforms = beam.uniforms(pipe.schema.uniforms, {
  modelMat: identity(new Float32Array(16)),
  viewMat,
  projectionMat,
})

beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(pipe, { verts, index, uniforms })
})
