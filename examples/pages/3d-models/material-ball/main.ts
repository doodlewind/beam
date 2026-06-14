import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import wgsl from './pbr.wgsl?raw'
import { createBall } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'
import { create, rotate, multiply } from '../../../shared/mat4'
import { rotateY } from '../../../shared/vec3'
import { loadBitmap, loadCubeFaces } from '../../../shared/image-loader'

const canvas = document.querySelector('canvas')!
canvas.width = 600
canvas.height = 600

const beam = await Beam.gpu(canvas)

// PBR pipeline. Uniform field order mirrors the WGSL Uniforms struct: a scalar
// follows each vec3 to fill std140 trailing padding (DESIGN §4).
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', normal: 'vec3', texCoord: 'vec2' },
  uniforms: {
    cameraPos: 'vec3',
    metallic: 'f32',
    modelMat: 'mat4',
    mvpMat: 'mat4',
    baseColor: 'vec4',
    lightDir: 'vec3',
    roughness: 'f32',
    lightColor: 'vec3',
    lightStrength: 'f32',
  },
  textures: { diffuseEnv: 'texCube', specularEnv: 'texCube', brdfLUT: 'tex2d' },
  samplers: { envSamp: 'sampler', lutSamp: 'sampler' },
  depth: true,
  cull: 'back',
})

const ball = createBall()
const verts = beam.verts(pipe.schema.vertex, ball.vertex)
const index = beam.index(ball.index)

const baseEye = [0, 0, 10]
const center: [number, number, number] = [0, 0, 0]

const mvp = (modelMat: Float32Array, eye: number[] | Float32Array) => {
  const { viewMat, projectionMat } = createCamera({ eye, center }, { canvas })
  return multiply(
    create(),
    multiply(create(), projectionMat, viewMat),
    modelMat
  )
}

const uniforms = beam.uniforms(pipe.schema.uniforms, {
  cameraPos: baseEye,
  metallic: 1,
  modelMat: create(),
  mvpMat: mvp(create(), baseEye),
  baseColor: [1, 1, 1, 1],
  lightDir: [1, 1, 1],
  roughness: 0.2,
  lightColor: [1, 1, 1],
  lightStrength: 1,
})

// Env maps + BRDF LUT. The original streamed a 10-level pre-filtered specular
// cube face-by-face; here we load the sharpest (level-0) faces and let Beam
// auto-generate the mip chain (roughness still drives sampled LOD).
const [diffuseFaces, specularFaces, brdf] = await Promise.all([
  loadCubeFaces(asset('/assets/ibl/helipad/diffuse'), 'jpg', [
    'diffuse_right_0',
    'diffuse_left_0',
    'diffuse_top_0',
    'diffuse_bottom_0',
    'diffuse_front_0',
    'diffuse_back_0',
  ]),
  loadCubeFaces(asset('/assets/ibl/helipad/specular'), 'jpg', [
    'specular_right_0',
    'specular_left_0',
    'specular_top_0',
    'specular_bottom_0',
    'specular_front_0',
    'specular_back_0',
  ]),
  loadBitmap(asset('/assets/ibl/brdfLUT.png')),
])

type Faces = Parameters<typeof beam.cube>[0]
const diffuseEnv = beam.cube(diffuseFaces as Faces, { srgb: true })
const specularEnv = beam.cube(specularFaces as Faces, {
  srgb: true,
  mips: true,
})
const brdfLUT = beam.texture(brdf)
const envSamp = beam.sampler({
  wrap: 'clamp',
  min: 'linear',
  mag: 'linear',
  mip: 'linear',
})
const lutSamp = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })

const textures = { diffuseEnv, specularEnv, brdfLUT }
const samplers = { envSamp, lutSamp }

const render = () => {
  beam.frame(() => {
    beam
      .clear([0, 0, 0, 1])
      .draw(pipe, { verts, index, uniforms, textures, samplers })
  })
}
render()

// --- Controls -------------------------------------------------------------
const $ = (id: string) => document.getElementById(id) as HTMLInputElement

const updateScene = () => {
  const modelMat = create()
  rotate(modelMat, modelMat, (+$('model-x').value / 180) * Math.PI, [1, 0, 0])
  rotate(modelMat, modelMat, (+$('model-y').value / 180) * Math.PI, [0, 1, 0])
  rotate(modelMat, modelMat, (+$('model-z').value / 180) * Math.PI, [0, 0, 1])
  const eye = rotateY(
    [0, 0, 0],
    baseEye,
    [0, 0, 0],
    (+$('camera-rotate').value / 180) * Math.PI
  )
  uniforms
    .set('modelMat', modelMat)
    .set('mvpMat', mvp(modelMat, eye))
    .set('cameraPos', eye)
  render()
}
;['model-x', 'model-y', 'model-z', 'camera-rotate'].forEach((id) =>
  $(id).addEventListener('input', updateScene)
)

const updateMaterial = () => {
  uniforms
    .set('metallic', +$('metallic').value)
    .set('roughness', +$('roughness').value)
  render()
}
;['metallic', 'roughness'].forEach((id) =>
  $(id).addEventListener('input', updateMaterial)
)

const updateLight = () => {
  const hex = $('light-color').value
  uniforms
    .set('lightDir', [
      +$('light-x').value,
      +$('light-y').value,
      +$('light-z').value,
    ])
    .set('lightStrength', +$('light-strength').value)
    .set('lightColor', [
      parseInt(hex.slice(1, 3), 16) / 256,
      parseInt(hex.slice(3, 5), 16) / 256,
      parseInt(hex.slice(5, 7), 16) / 256,
    ])
  render()
}
;['light-x', 'light-y', 'light-z', 'light-strength', 'light-color'].forEach(
  (id) => $(id).addEventListener('input', updateLight)
)
