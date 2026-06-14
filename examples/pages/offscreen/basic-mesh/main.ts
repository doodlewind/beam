import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import meshWgsl from './mesh.wgsl?raw'
import quadWgsl from './quad.wgsl?raw'
import { parseOBJ } from '../../../shared/obj-loader'
import { createCamera } from '../../../shared/camera'
import { createRect } from '../../../shared/geometry'
import { create, rotate, normalMatrix } from '../../../shared/mat4'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

// Pass 1: Lambert-lit mesh, drawn into an offscreen color+depth target.
const meshPipe = beam.pipeline({
  wgsl: meshWgsl,
  vertex: { position: 'vec3', normal: 'vec3' },
  uniforms: {
    modelMat: 'mat4',
    viewMat: 'mat4',
    projectionMat: 'mat4',
    normalMat: 'mat4',
    lightDir: 'vec3',
    strength: 'f32',
    lightColor: 'vec3',
  },
  // Match the target's depth32float attachment.
  depth: { format: 'depth32float' },
  cull: 'none',
})

// Pass 2: sample the target color onto a full-screen quad.
const quadPipe = beam.pipeline({
  wgsl: quadWgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})

const { viewMat, projectionMat } = createCamera({ eye: [0, 6, 6] }, { canvas })
const meshUniforms = beam.uniforms(meshPipe.schema.uniforms, {
  modelMat: create(),
  viewMat,
  projectionMat,
  normalMat: create(),
  lightDir: [0, 0, 1],
  strength: 1,
  lightColor: [0.4, 0.7, 1],
})

const target = beam.target({ width: 1024, height: 1024, depth: true })

const quad = createRect()
const quadVerts = beam.verts(quadPipe.schema.vertex, quad.vertex)
const quadIndex = beam.index(quad.index)
const sampler = beam.sampler({ min: 'linear', mag: 'linear' })

const resp = await fetch(asset('/assets/models/bunny.obj'))
const [model] = parseOBJ(await resp.text())
const meshVerts = beam.verts(meshPipe.schema.vertex, model.vertex)
const meshIndex = beam.index(model.index)

beam.loop((t) => {
  const modelMat = rotate(create(), create(), t * 0.0005, [0, 1, 0])
  meshUniforms.set('modelMat', modelMat)
  meshUniforms.set('normalMat', normalMatrix(create(), modelMat))

  // Offscreen: render the lit mesh.
  target.clear([0, 0, 0, 1]).draw(meshPipe, {
    verts: meshVerts,
    index: meshIndex,
    uniforms: meshUniforms,
  })

  // Screen: blit the offscreen color onto a full-screen quad.
  beam.clear([0, 0, 0, 1]).draw(quadPipe, {
    verts: quadVerts,
    index: quadIndex,
    textures: { img: target.color },
    samplers: { samp: sampler },
  })
})
