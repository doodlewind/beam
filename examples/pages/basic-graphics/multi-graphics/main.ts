import { Beam } from 'beam-gpu'
import wgsl from './multi.wgsl?raw'
import { createBox, createBall } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'
import { create, translate } from '../../../shared/mat4'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

// Normal-as-color pipeline. depth:true so overlapping objects sort correctly.
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', normal: 'vec3' },
  uniforms: { modelMat: 'mat4', viewMat: 'mat4', projectionMat: 'mat4' },
  depth: true,
  cull: 'none',
})

// Two geometries sharing the { position, normal } schema. Each gets its own
// vertex + index buffers; the draw loop picks one per grid cell.
const box = createBox()
const ball = createBall()
const boxBuffers = {
  verts: beam.verts(pipe.schema.vertex, box.vertex),
  index: beam.index(box.index),
}
const ballBuffers = {
  verts: beam.verts(pipe.schema.vertex, ball.vertex),
  index: beam.index(ball.index),
}

const { viewMat, projectionMat } = createCamera(
  { eye: [0, 50, 50], center: [10, 10, 0] },
  { canvas }
)

// One uniforms resource PER object (DESIGN §3.3): a single shared buffer re-set
// between draws would read the last modelMat for every object in the frame.
const baseMat = create()
const objects: {
  buffers: typeof boxBuffers
  uniforms: ReturnType<typeof beam.uniforms>
}[] = []
for (let i = 1; i < 10; i++) {
  for (let j = 1; j < 10; j++) {
    const modelMat = translate(create(), baseMat, [i * 2, j * 2, 0])
    const uniforms = beam.uniforms(pipe.schema.uniforms, {
      modelMat,
      viewMat,
      projectionMat,
    })
    objects.push({ buffers: (i + j) % 2 ? ballBuffers : boxBuffers, uniforms })
  }
}

beam.frame(() => {
  beam.clear([0, 0, 0, 1])
  for (const { buffers, uniforms } of objects) {
    beam.draw(pipe, { verts: buffers.verts, index: buffers.index, uniforms })
  }
})
