import { Beam, ResourceTypes } from '../../../src/index.js'
import { CheckDepth, ShadowLighting, VoidDepth } from './shadow-plugins.js'
import { createBall, createRect } from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create, translate, multiply } from '../../utils/mat4.js'
import { subtract } from '../../utils/vec3.js'
import {
  initOffscreen, Offscreen2DCommand, createShadowCamera
} from './utils.js'
const {
  DataBuffers, IndexBuffer, Uniforms, Textures, Offscreen
} = ResourceTypes

const canvas = document.querySelector('canvas')
canvas.height = document.body.offsetHeight
canvas.width = document.body.offsetWidth
const beam = new Beam(canvas, {
  extensions: [
    'OES_element_index_uint', 'WEBGL_depth_texture'
  ]
})

beam.define(Offscreen2DCommand)
const voidDepthPlugin = beam.plugin(VoidDepth)
const lightingPlugin = beam.plugin(ShadowLighting)

const ball = createBall()
const plane = createRect([10, 5, -5], 1, 15)
const planeData = beam.resource(DataBuffers, plane.data)
const planeIndex = beam.resource(IndexBuffer, plane.index)

const ballData = beam.resource(DataBuffers, ball.data)
const ballIndex = beam.resource(IndexBuffer, ball.index)

const offscreenRes = beam.resource(Offscreen, {
  depth: true, init: initOffscreen
})
const imgRes = beam.resource(Textures)
const shadowMap = beam.resource(Textures)
imgRes.set('img', offscreenRes)
shadowMap.set('shadowMap', offscreenRes)

// screen quad
const quadRect = createRect()
const quadDataRes = beam.resource(DataBuffers, quadRect.data)
const quadIndexRes = beam.resource(IndexBuffer, quadRect.index)

const baseModelMat = create()

const eye = [0, 50, 50]
const center = [10, 10, 0]
const lightPosition = [20, 50, 50]
const lightDir = []
subtract(lightDir, lightPosition, center)

const defaultCamera = createCamera({ eye, center }, { canvas })
let shadowCamera = createShadowCamera(lightPosition, center, 50)

const uniforms = beam.resource(Uniforms)
uniforms.set('dirLight.direction', lightDir)

const drawDepth = () => {
  uniforms.set('modelMat', create())
  beam.draw(voidDepthPlugin, planeData, planeIndex, uniforms)
  for (let i = 1; i < 10; i++) {
    for (let j = 1; j < 10; j++) {
      const modelMat = translate([], baseModelMat, [i * 2, j * 2, 0])
      uniforms.set('modelMat', modelMat)
      beam.draw(voidDepthPlugin, ballData, ballIndex, uniforms)
    }
  }
}

const drawLighting = () => {
  uniforms.set('modelMat', create())
  beam.draw(lightingPlugin, planeData, planeIndex, shadowMap, uniforms)
  for (let i = 1; i < 10; i++) {
    for (let j = 1; j < 10; j++) {
      const modelMat = translate([], baseModelMat, [i * 2, j * 2, 0])
      uniforms.set('modelMat', modelMat)
      beam.draw(lightingPlugin, ballData, ballIndex, shadowMap, uniforms)
    }
  }
}

const render = () => {
  beam.clear()
  beam.offscreen2D(offscreenRes, () => {
    uniforms
      .set('viewMat', shadowCamera.viewMat)
      .set('projectionMat', shadowCamera.projectionMat)
    drawDepth()
  })

  const lightSpaceMat = create()
  multiply(lightSpaceMat, shadowCamera.projectionMat, shadowCamera.viewMat)
  uniforms
    .set('lightPosition', lightPosition)
    .set('lightSpaceMat', lightSpaceMat)
    .set('viewMat', defaultCamera.viewMat)
    .set('projectionMat', defaultCamera.projectionMat)
  drawLighting()
}

render()

const SHOW_DEPTH = false // for debug
if (SHOW_DEPTH) {
  CheckDepth.defines.USE_ORTHO = true
  const checkDepthPlugin = beam.plugin(CheckDepth)
  // for perspective, tweak nearPlane and farPlane uniforms
  beam.draw(checkDepthPlugin, quadDataRes, quadIndexRes, uniforms, imgRes)
}

const $dirX = document.getElementById('dir-x')
const $dirY = document.getElementById('dir-y')
;[$dirX, $dirY].forEach(input => {
  input.addEventListener('input', () => {
    const dx = parseFloat($dirX.value)
    const dy = parseFloat($dirY.value)
    const lightPosition = [dx, dy, 50]
    const lightDir = []
    subtract(lightDir, lightPosition, center)
    shadowCamera = createShadowCamera(lightPosition, center, 50)
    uniforms.set('dirLight.direction', lightDir)
    render()
  })
})
