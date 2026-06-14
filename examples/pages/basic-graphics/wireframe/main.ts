import { Beam } from 'beam-gpu'
import { createCamera } from '../../../shared/camera'
import { createBall, toWireframe } from '../../../shared/geometry'
import { identity } from '../../../shared/mat4'
import normalWgsl from './normal.wgsl?raw'
import wireframeWgsl from './wireframe.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

// Solid normal-colored ball + a red wireframe overlay (line-list primitive).
const normal = beam.pipeline({
  wgsl: normalWgsl,
  vertex: { position: 'vec3', normal: 'vec3' },
  uniforms: { modelMat: 'mat4', viewMat: 'mat4', projectionMat: 'mat4' },
})
const wireframe = beam.pipeline({
  wgsl: wireframeWgsl,
  vertex: { position: 'vec3' },
  uniforms: { modelMat: 'mat4', viewMat: 'mat4', projectionMat: 'mat4' },
  primitive: 'line',
})

const cam = createCamera({ eye: [0, 10, 10] }, { canvas })
const uniformState = {
  modelMat: identity(new Float32Array(16)),
  viewMat: cam.viewMat,
  projectionMat: cam.projectionMat,
}

const ball = createBall([0, 0, 0], 1, 10, 10)
const verts = beam.verts(normal.schema.vertex, ball.vertex)
const triIndex = beam.index(ball.index)
const wireIndex = beam.index(toWireframe(ball.index))

// One uniforms resource per pipeline schema (each pipeline has its own layout).
const normalUniforms = beam.uniforms(normal.schema.uniforms, uniformState)
const wireUniforms = beam.uniforms(wireframe.schema.uniforms, uniformState)

beam.frame(() => {
  beam
    .clear([0, 0, 0, 1])
    .draw(normal, { verts, index: triIndex, uniforms: normalUniforms })
    .draw(wireframe, { verts, index: wireIndex, uniforms: wireUniforms })
})
