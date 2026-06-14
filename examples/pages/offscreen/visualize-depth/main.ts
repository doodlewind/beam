import { Beam } from 'beam-gpu'
import lightingWGSL from './lighting.wgsl?raw'
import inspectWGSL from './inspect-depth.wgsl?raw'
import { createBall, createRect } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'
import { create, translate } from '../../../shared/mat4'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

const near = 0.1
const far = 100

// Pass 1: draw the ball grid into an offscreen target purely to fill its
// depth buffer. cull:'back' so only front faces contribute depth.
const lighting = beam.pipeline({
  wgsl: lightingWGSL,
  vertex: { position: 'vec3', normal: 'vec3' },
  uniforms: {
    modelMat: 'mat4',
    viewMat: 'mat4',
    projectionMat: 'mat4',
    normalMat: 'mat4',
    lightDir: 'vec3',
    strength: 'f32',
  },
  // Match the target's depth32float attachment (sampled by the inspect pass).
  depth: { format: 'depth32float' },
  cull: 'back',
})

// Pass 2: full-screen quad sampling target.depth -> grayscale.
const inspect = beam.pipeline({
  wgsl: inspectWGSL,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { nearPlane: 'f32', farPlane: 'f32' },
  textures: { depth: 'texDepth' },
  // depth32float is non-filterable, so it needs a non-filtering sampler.
  samplers: { samp: 'samplerNonFilter' },
})

const ball = createBall()
const ballVerts = beam.verts(lighting.schema.vertex, ball.vertex)
const ballIndex = beam.index(ball.index)

const quad = createRect()
const quadVerts = beam.verts(inspect.schema.vertex, quad.vertex)
const quadIndex = beam.index(quad.index)

const { viewMat, projectionMat } = createCamera(
  { eye: [0, 50, 50], center: [10, 10, 0] },
  { canvas, zNear: near, zFar: far }
)

// One uniforms resource per ball — a shared buffer re-set between draws would
// read the LAST modelMat for every ball (writeBuffer-before-submit).
const ballUniforms: ReturnType<typeof beam.uniforms>[] = []
for (let i = 1; i < 10; i++) {
  for (let j = 1; j < 10; j++) {
    const modelMat = translate(create(), create(), [i * 2, j * 2, 0])
    ballUniforms.push(
      beam.uniforms(lighting.schema.uniforms, {
        modelMat,
        viewMat,
        projectionMat,
        normalMat: create(),
        lightDir: [1, 1, 1],
        strength: 0.5,
      })
    )
  }
}

const target = beam.target({ width: 1024, height: 1024, depth: true })
const sampler = beam.sampler({ min: 'nearest', mag: 'nearest', wrap: 'clamp' })
const inspectUniforms = beam.uniforms(inspect.schema.uniforms, {
  nearPlane: near,
  farPlane: far,
})

beam.frame(() => {
  target.clear([0, 0, 0, 1])
  for (const uniforms of ballUniforms) {
    target.draw(lighting, { verts: ballVerts, index: ballIndex, uniforms })
  }
  beam.clear([0, 0, 0, 1]).draw(inspect, {
    verts: quadVerts,
    index: quadIndex,
    uniforms: inspectUniforms,
    textures: { depth: target.depth! },
    samplers: { samp: sampler },
  })
})
