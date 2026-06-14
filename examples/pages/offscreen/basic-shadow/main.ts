import { Beam } from 'beam-gpu'
import depthWgsl from './depth.wgsl?raw'
import lightingWgsl from './lighting.wgsl?raw'
import { createBall, createRect } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'
import {
  create,
  translate,
  multiply,
  lookAt,
  ortho,
  normalMatrix,
  type Mat4,
} from '../../../shared/mat4'

const canvas = document.querySelector('canvas')!
canvas.width = 600
canvas.height = 600

const beam = await Beam.gpu(canvas)

// Pass 1: render scene depth from the light's POV into an offscreen depth target.
const depthPipe = beam.pipeline({
  wgsl: depthWgsl,
  vertex: { position: 'vec3' },
  uniforms: { modelMat: 'mat4', viewMat: 'mat4', projectionMat: 'mat4' },
  // Match the target's depth32float attachment (sampleable for the shadow map).
  depth: { format: 'depth32float' },
  cull: 'none',
})

// Pass 2: shade from the camera, sampling the shadow map with a comparison sampler.
const lightingPipe = beam.pipeline({
  wgsl: lightingWgsl,
  vertex: { position: 'vec3', normal: 'vec3' },
  uniforms: {
    modelMat: 'mat4',
    viewMat: 'mat4',
    projectionMat: 'mat4',
    lightSpaceMat: 'mat4',
    normalMat: 'mat4',
    lightDir: 'vec3',
    strength: 'f32',
    lightColor: 'vec3',
  },
  textures: { shadowMap: 'texDepth' },
  samplers: { shadowSamp: 'samplerCompare' },
  depth: true,
  cull: 'none',
})

// Geometry: one ground plane plus a 9x9 grid of balls hovering above it.
const ball = createBall()
const plane = createRect([10, 5, -5], 1, 15)
const planeVerts = beam.verts(lightingPipe.schema.vertex, plane.vertex)
const planeIndex = beam.index(plane.index)
const ballVerts = beam.verts(lightingPipe.schema.vertex, ball.vertex)
const ballIndex = beam.index(ball.index)

// One model matrix per object (DESIGN §3.3: every object needs its own uniforms).
const modelMats: Mat4[] = [create()] // plane at origin
for (let i = 1; i < 10; i++) {
  for (let j = 1; j < 10; j++) {
    modelMats.push(translate(create(), create(), [i * 2, j * 2, 0]))
  }
}
const isBall = modelMats.map((_, k) => k > 0)

// Scene + light cameras.
const center = [10, 10, 0]
const eye = [0, 50, 50]
const lightPosition = [20, 50, 50]

const camera = createCamera({ eye, center }, { canvas })

const SHADOW_SIZE = 2048
const target = beam.target({
  width: SHADOW_SIZE,
  height: SHADOW_SIZE,
  depth: true,
})
const shadowSampler = beam.sampler({
  compare: 'less',
  min: 'linear',
  mag: 'linear',
})

const lightSpaceMat = create()
const lightDir = [
  lightPosition[0] - center[0],
  lightPosition[1] - center[1],
  lightPosition[2] - center[2],
]

// Per-object uniforms for both passes — separate buffers so each draw reads its own value.
const depthUniforms = modelMats.map((m) =>
  beam.uniforms(depthPipe.schema.uniforms, { modelMat: m })
)
const lightUniforms = modelMats.map((m) =>
  beam.uniforms(lightingPipe.schema.uniforms, {
    modelMat: m,
    normalMat: normalMatrix(create(), m),
    lightDir,
    strength: 1,
    lightColor: [1, 1, 1],
  })
)

const updateLight = () => {
  // Orthographic shadow camera looking from the light toward the scene center.
  const viewMat = lookAt(create(), lightPosition, center, [0, 1, 0])
  const projectionMat = ortho(create(), -50, 50, -50, 50, 0.1, 100)
  multiply(lightSpaceMat, projectionMat, viewMat)
  depthUniforms.forEach((u) => u.set({ viewMat, projectionMat }))
  lightUniforms.forEach((u) =>
    u.set({
      viewMat: camera.viewMat,
      projectionMat: camera.projectionMat,
      lightSpaceMat,
      lightDir,
    })
  )
}
updateLight()

beam.frame(() => {
  // Pass 1: fill the shadow map (depth only).
  target.clear([0, 0, 0, 1])
  modelMats.forEach((_, k) => {
    target.draw(depthPipe, {
      verts: isBall[k] ? ballVerts : planeVerts,
      index: isBall[k] ? ballIndex : planeIndex,
      uniforms: depthUniforms[k],
    })
  })

  // Pass 2: shade the scene, sampling the shadow map.
  beam.clear([0, 0, 0, 1])
  modelMats.forEach((_, k) => {
    beam.draw(lightingPipe, {
      verts: isBall[k] ? ballVerts : planeVerts,
      index: isBall[k] ? ballIndex : planeIndex,
      uniforms: lightUniforms[k],
      textures: { shadowMap: target.depth! },
      samplers: { shadowSamp: shadowSampler },
    })
  })
})
