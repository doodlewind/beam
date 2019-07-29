import { BeamRenderer, ResourceTypes } from '../../../src/index.js'
import {
  NormalGraphics, WireframeGraphics
} from '../../plugins/basic-graphics-plugins.js'
import {
  createBall, createBox, toWireframe
} from '../../utils/graphics-utils.js'
import { createCamera } from '../../utils/camera.js'
import { create } from '../../utils/mat4.js'
const { DataBuffers, IndexBuffer, Uniforms } = ResourceTypes

const identityMat = create()

class Mesh {
  constructor (beam, { data, index }, modelMat = identityMat) {
    this.beam = beam
    this.data = beam.resource(DataBuffers, data)
    this.defaultIndex = beam.resource(IndexBuffer, index)
    this.wireframeIndex = beam.resource(IndexBuffer, toWireframe(index))
    this.modelMat = modelMat
  }

  /* TODO support mesh transform chaining
  translate () {
    return this
  }

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
    this.defaultPlugin = this.beam.plugin(NormalGraphics)
    this.wireframePlugin = this.beam.plugin(WireframeGraphics)
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
    const { beam, defaultPlugin, wireframePlugin, meshes, camera } = this
    beam.clear()
    meshes.forEach(mesh => {
      const transform = beam.resource(Uniforms, { 'modelMat': mesh.modelMat })
      const resources = [mesh.data, camera, transform]
      if (this.wireframe) {
        beam.draw(wireframePlugin, mesh.wireframeIndex, ...resources)
      }
      beam.draw(defaultPlugin, mesh.defaultIndex, ...resources)
    })
  }
}
