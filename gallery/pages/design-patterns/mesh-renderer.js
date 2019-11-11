import { BeamRenderer, ResourceTypes } from '../../../src/index.js'
import {
  NormalColor, RedWireframe
} from '../../shaders/basic-graphics-shaders.js'
import {
  createBall, createBox, toWireframe
} from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create, translate } from '../../utils/mat4.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

class Mesh {
  constructor (beam, { data, index }, modelMat) {
    this.beam = beam
    this.data = beam.resource(DataBuffers, data)
    this.defaultIndex = beam.resource(IndexBuffer, index)
    this.wireframeIndex = beam.resource(IndexBuffer, toWireframe(index))
    this.modelMat = modelMat || create()
  }

  translate ([x, y, z]) {
    translate(this.modelMat, this.modelMat, [x, y, z])
    return this
  }

  /* TODO support mesh transform chaining
  rotate () {
    return this
  }

  scale () {
    return this
  }
  */
}

class BoxMesh extends Mesh {
  constructor (beam, modelMat) {
    const box = createBox()
    super(beam, box, modelMat)
  }
}

class BallMesh extends Mesh {
  constructor (beam, modelMat, latBands = 50, longBands = 50) {
    const ball = createBall([0, 0, 0], 1, latBands, longBands)
    super(beam, ball, modelMat)
  }
}

export class MeshRenderer extends BeamRenderer {
  constructor (canvas) {
    super(canvas)
    this.defaultShader = this.beam.shader(NormalColor)
    this.wireframeShader = this.beam.shader(RedWireframe)
    this.wireframe = true
    this.meshes = []
    this.camera = this.beam.resource(Uniforms, createCamera({}, { canvas }))
  }

  BoxMesh (...args) { return new BoxMesh(this.beam, ...args) }
  BallMesh (...args) { return new BallMesh(this.beam, ...args) }

  add (mesh) { this.meshes.push(mesh) }
  remove (mesh) { this.meshes.splice(this.meshes.indexOf(mesh), 1) }

  setCamera (eye, center, up) {
    const { viewMat } = createCamera({ eye, center, up })
    this.camera.set('viewMat', viewMat)
  }

  render () {
    const { beam, defaultShader, wireframeShader, meshes, camera } = this
    beam.clear()
    meshes.forEach(mesh => {
      const transform = beam.resource(Uniforms, { 'modelMat': mesh.modelMat })
      const resources = [mesh.data, camera, transform]
      if (this.wireframe) {
        beam.draw(wireframeShader, mesh.wireframeIndex, ...resources)
      }
      beam.draw(defaultShader, mesh.defaultIndex, ...resources)
    })
  }
}
