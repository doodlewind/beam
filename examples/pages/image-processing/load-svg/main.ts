import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import wgsl from './image.wgsl?raw'
import { createRect } from '../../../shared/geometry'
import { createCamera } from '../../../shared/camera'
import { loadImages } from '../../../shared/image-loader'
import { create, identity } from '../../../shared/mat4'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { modelMat: 'mat4', viewMat: 'mat4', projectionMat: 'mat4' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' },
})

// loadImages routes the .svg path through the SVG blob loader for us.
const [image] = await loadImages(asset('/assets/images/world-map.svg'))

const rect = createRect([0, 0, 0], image.height / image.width)
const verts = beam.verts(pipe.schema.vertex, rect.vertex)
const index = beam.index(rect.index)

const cam = createCamera({ eye: [0, 0, 5] }, { canvas })
const uniforms = beam.uniforms(pipe.schema.uniforms, {
  modelMat: identity(create()),
  ...cam,
})

const img = beam.texture(image, { flipY: true })
const samp = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })

beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(pipe, {
    verts,
    index,
    uniforms,
    textures: { img },
    samplers: { samp },
  })
})
