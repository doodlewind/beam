import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import wgsl from './lighting.wgsl?raw'
import { parseOBJ } from '../../../shared/obj-loader'
import { createCamera } from '../../../shared/camera'
import { create, rotate, normalMatrix } from '../../../shared/mat4'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)

const pipe = beam.pipeline({
  wgsl,
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
  depth: true,
  cull: 'back',
})

const { viewMat, projectionMat } = createCamera({ eye: [0, 6, 6] }, { canvas })
const uniforms = beam.uniforms(pipe.schema.uniforms, {
  modelMat: create(),
  viewMat,
  projectionMat,
  normalMat: create(),
  lightDir: [1, 1, 1],
  strength: 0.5,
  lightColor: [1, 1, 1],
})

let verts: ReturnType<typeof beam.verts> | null = null
let index: ReturnType<typeof beam.index> | null = null

const render = () => {
  if (!verts || !index) return
  beam.frame(() => {
    beam
      .clear([0, 0, 0, 1])
      .draw(pipe, { verts: verts!, index: index!, uniforms })
  })
}

const resp = await fetch(asset('/assets/models/bunny.obj'))
const [model] = parseOBJ(await resp.text())
verts = beam.verts(pipe.schema.vertex, model.vertex)
index = beam.index(model.index)
render()

// --- Controls: model rotation + light direction / color / strength ---------
const $ = (id: string) => document.getElementById(id) as HTMLInputElement

const updateModel = () => {
  const modelMat = create()
  rotate(modelMat, modelMat, (+$('model-x').value / 180) * Math.PI, [1, 0, 0])
  rotate(modelMat, modelMat, (+$('model-y').value / 180) * Math.PI, [0, 1, 0])
  rotate(modelMat, modelMat, (+$('model-z').value / 180) * Math.PI, [0, 0, 1])
  uniforms.set('modelMat', modelMat)
  uniforms.set('normalMat', normalMatrix(create(), modelMat))
  render()
}
;['model-x', 'model-y', 'model-z'].forEach((id) =>
  $(id).addEventListener('input', updateModel)
)

const updateLight = () => {
  uniforms.set('lightDir', [
    +$('dir-x').value,
    +$('dir-y').value,
    +$('dir-z').value,
  ])
  uniforms.set('strength', +$('dir-strength').value)
  const hex = $('dir-color').value
  uniforms.set('lightColor', [
    parseInt(hex.slice(1, 3), 16) / 256,
    parseInt(hex.slice(3, 5), 16) / 256,
    parseInt(hex.slice(5, 7), 16) / 256,
  ])
  render()
}
;['dir-x', 'dir-y', 'dir-z', 'dir-strength', 'dir-color'].forEach((id) =>
  $(id).addEventListener('input', updateLight)
)
