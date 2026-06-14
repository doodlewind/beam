import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import wgsl from './pbr.wgsl?raw'
import { createBall } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'
import { create, multiply, translate } from '../../../shared/mat4'
import { loadBitmap } from '../../../shared/image-loader'

const canvas = document.querySelector('canvas')!
canvas.width = 600
canvas.height = 600

const beam = await Beam.gpu(canvas)

const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', normal: 'vec3' },
  uniforms: {
    mvpMat: 'mat4',
    modelMat: 'mat4',
    camera: 'vec3',
    lightStrength: 'f32',
    metalRough: 'vec2',
    lightDir: 'vec3',
    _pad: 'f32',
    lightColor: 'vec3',
  },
  textures: { diffuseEnv: 'texCube', specularEnv: 'texCube', brdfLUT: 'tex2d' },
  samplers: { samp: 'sampler' },
  depth: true,
  cull: 'back',
})

// Geometry: one shared ball mesh, drawn N times.
const ball = createBall([0, 0, 0], 0.9)
const verts = beam.verts(pipe.schema.vertex, ball.vertex)
const index = beam.index(ball.index)

// Camera looking at the centre of the grid.
const N = 5
const span = (N - 1) * 2
const eye = [span / 2, span / 2, span + 4]
const center = [span / 2, span / 2, 0]
const { viewMat, projectionMat } = createCamera(
  { eye, center },
  { canvas, fov: Math.PI / 5 }
)
const viewProjMat = multiply(create(), projectionMat, viewMat)

// One uniforms resource PER ball (DESIGN §3.3): all draws submit together, so a
// shared UBO would read the last-written metalRough for every ball.
const balls: ReturnType<typeof beam.uniforms>[] = []
for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    const modelMat = translate(create(), create(), [i * 2, j * 2, 0])
    const u = beam.uniforms(pipe.schema.uniforms, {
      mvpMat: multiply(create(), viewProjMat, modelMat),
      modelMat,
      camera: eye,
      lightStrength: 1,
      metalRough: [i / (N - 1), Math.max(j / (N - 1), 0.05)], // metallic, roughness
      lightDir: [1, 1, 1],
      lightColor: [1, 1, 1],
    })
    balls.push(u)
  }
}

const sampler = beam.sampler({
  wrap: 'clamp',
  min: 'linear',
  mag: 'linear',
  mip: 'linear',
})

// Load IBL: diffuse irradiance cube, specular cube (mips auto-generated), BRDF LUT.
const dir = asset('/assets/ibl/helipad')
const faces = ['right', 'left', 'top', 'bottom', 'front', 'back']
const [diffuseFaces, specularFaces, brdf] = await Promise.all([
  Promise.all(
    faces.map((f) => loadBitmap(`${dir}/diffuse/diffuse_${f}_0.jpg`))
  ),
  Promise.all(
    faces.map((f) => loadBitmap(`${dir}/specular/specular_${f}_0.jpg`))
  ),
  loadBitmap(asset('/assets/ibl/brdfLUT.png')),
])

type Faces = Parameters<typeof beam.cube>[0]
const textures = {
  diffuseEnv: beam.cube(diffuseFaces as Faces, { srgb: true }),
  specularEnv: beam.cube(specularFaces as Faces, { srgb: true, mips: true }),
  brdfLUT: beam.texture(brdf),
}

beam.frame(() => {
  beam.clear([0, 0, 0, 1])
  for (const uniforms of balls) {
    beam.draw(pipe, {
      verts,
      index,
      uniforms,
      textures,
      samplers: { samp: sampler },
    })
  }
})
