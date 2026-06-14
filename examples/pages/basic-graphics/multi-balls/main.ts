import { Beam } from 'beam-gpu'
import { createBall } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'
import { create, translate } from '../../../shared/mat4'
import wgsl from './multi-balls.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', normal: 'vec3' },
  uniforms: { modelMat: 'mat4', viewMat: 'mat4', projectionMat: 'mat4' },
  depth: true,
  cull: 'none',
})

const ball = createBall()
const verts = beam.verts(pipe.schema.vertex, ball.vertex)
const index = beam.index(ball.index)

const { viewMat, projectionMat } = createCamera(
  { eye: [0, 50, 50], center: [10, 10, 0] },
  { canvas }
)

// One uniforms resource PER ball (DESIGN §3.3): a single shared buffer
// re-set between draws would read the last modelMat for every ball.
const baseMat = create()
const balls: ReturnType<typeof beam.uniforms>[] = []
for (let i = 1; i < 10; i++) {
  for (let j = 1; j < 10; j++) {
    const modelMat = translate(create(), baseMat, [i * 2, j * 2, 0])
    balls.push(
      beam.uniforms(pipe.schema.uniforms, { modelMat, viewMat, projectionMat })
    )
  }
}

beam.frame(() => {
  beam.clear([0, 0, 0, 1])
  for (const uniforms of balls) beam.draw(pipe, { verts, index, uniforms })
})
