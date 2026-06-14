import { asset } from '../../../shared/asset'
import { Beam } from 'beam-gpu'
import { Pane } from 'tweakpane'
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
const params = {
  modelX: 0,
  modelY: 0,
  modelZ: 0,
  dirX: 1,
  dirY: 1,
  dirZ: 1,
  strength: 0.5,
  color: '#ffffff',
}

const updateModel = () => {
  const modelMat = create()
  rotate(modelMat, modelMat, (params.modelX / 180) * Math.PI, [1, 0, 0])
  rotate(modelMat, modelMat, (params.modelY / 180) * Math.PI, [0, 1, 0])
  rotate(modelMat, modelMat, (params.modelZ / 180) * Math.PI, [0, 0, 1])
  uniforms.set('modelMat', modelMat)
  uniforms.set('normalMat', normalMatrix(create(), modelMat))
  render()
}

const updateLight = () => {
  uniforms.set('lightDir', [params.dirX, params.dirY, params.dirZ])
  uniforms.set('strength', params.strength)
  const hex = params.color
  uniforms.set('lightColor', [
    parseInt(hex.slice(1, 3), 16) / 256,
    parseInt(hex.slice(3, 5), 16) / 256,
    parseInt(hex.slice(5, 7), 16) / 256,
  ])
  render()
}

const pane = new Pane({ title: 'Controls' })

const modelFolder = pane.addFolder({ title: 'Model' })
modelFolder.addBinding(params, 'modelX', {
  label: 'Rotate X',
  min: -180,
  max: 180,
  step: 0.01,
})
modelFolder.addBinding(params, 'modelY', {
  label: 'Rotate Y',
  min: -180,
  max: 180,
  step: 0.01,
})
modelFolder.addBinding(params, 'modelZ', {
  label: 'Rotate Z',
  min: -180,
  max: 180,
  step: 0.01,
})
modelFolder.on('change', updateModel)

const lightFolder = pane.addFolder({ title: 'Light' })
lightFolder.addBinding(params, 'dirX', {
  label: 'Light X',
  min: -1,
  max: 1,
  step: 0.01,
})
lightFolder.addBinding(params, 'dirY', {
  label: 'Light Y',
  min: -1,
  max: 1,
  step: 0.01,
})
lightFolder.addBinding(params, 'dirZ', {
  label: 'Light Z',
  min: -1,
  max: 1,
  step: 0.01,
})
lightFolder.addBinding(params, 'strength', {
  label: 'Strength',
  min: 0,
  max: 1,
  step: 0.01,
})
lightFolder.addBinding(params, 'color', { label: 'Color' })
lightFolder.on('change', updateLight)
