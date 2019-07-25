import { Beam, ResourceTypes } from '../../../src/index.js'
import { LambertLighting } from '../../plugins/basic-lighting-plugin.js'
import { loadImages, loadEnvMaps } from '../../utils/image-loader.js'
import { createBall } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
// import { rotateY } from '../../utils/vec3.js'
// import { createSolidCanvas } from './utils.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const canvas = document.getElementById('gl-canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas)

const plugin = beam.plugin(LambertLighting)
const camera = createCamera({ eye: [0, 0, 10] }, { canvas })
const matrixResource = beam.resource(Uniforms, camera)
const lightResource = beam.resource(Uniforms, {})

const ball = createBall()
const dataResource = beam.resource(DataBuffers, ball.data)
const indexResource = beam.resource(IndexBuffer, ball.index)

const base = '../../assets/'
Promise.all([
  loadEnvMaps(base + 'ibl/helipad'), loadImages(base + 'ibl/brdfLUT.png')
]).then(([[diffuseMaps, specularMaps], [brdf]]) => {
  console.log(diffuseMaps, specularMaps, brdf)

  beam.clear().draw(
    plugin,
    dataResource,
    indexResource,
    matrixResource,
    lightResource
  )
})
