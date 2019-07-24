import { Beam, ResourceTypes } from '../../../src/index.js'
import { NormalGraphics } from '../../plugins/basic-graphics-plugins.js'
import { createRect } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.getElementById('gl-canvas')
const beam = new Beam(canvas)

const plugin = beam.plugin(NormalGraphics)
const camera = createCamera({ eye: [0, 0, 10] }, { canvas })
const rect = createRect()

beam.clear().draw(
  plugin,
  beam.resource(DataBuffers, rect.data),
  beam.resource(IndexBuffer, rect.index),
  beam.resource(Uniforms, camera)
)
