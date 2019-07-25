/* eslint-env browser */

import { Beam, ResourceTypes } from '../../../src/index.js'
import { LambertLighting } from '../../plugins/basic-lighting-plugin.js'
import { parseOBJ } from '../../utils/obj-loader.js'
import { createCamera } from '../../utils/camera.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.getElementById('gl-canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas)
const plugin = beam.plugin(LambertLighting)
const camera = createCamera({ eye: [0, 6, 6] }, { canvas })
const cameraResource = beam.resource(Uniforms, camera)
const lightResource = beam.resource(Uniforms, {})
let dataResource
let indexResource

const render = () => beam.clear().draw(
  plugin, dataResource, indexResource, cameraResource, lightResource
)

fetch('../../assets/models/bunny.obj').then(resp => resp.text()).then(str => {
  const [model] = parseOBJ(str)
  dataResource = beam.resource(DataBuffers, model.data)
  indexResource = beam.resource(IndexBuffer, model.index)
  render()
})

const $dirX = document.getElementById('dir-x')
const $dirY = document.getElementById('dir-y')
const $dirZ = document.getElementById('dir-z')
  ;[$dirX, $dirY, $dirZ].forEach(input => {
  input.addEventListener('input', () => {
    const [dx, dy, dz] = [$dirX.value, $dirY.value, $dirZ.value]
    lightResource.set('dirLight.direction', [dx, dy, dz])
    render()
  })
})

const $dirStrength = document.getElementById('dir-strength')
$dirStrength.addEventListener('input', () => {
  lightResource.set('dirLight.strength', $dirStrength.value)
  render()
})

const $dirColor = document.getElementById('dir-color')
$dirColor.addEventListener('input', () => {
  const hex = $dirColor.value
  const rgb = [
    parseInt(hex.slice(1, 3), 16) / 256,
    parseInt(hex.slice(3, 5), 16) / 256,
    parseInt(hex.slice(5, 7), 16) / 256
  ]
  lightResource.set('dirLight.color', rgb)
  render()
})
