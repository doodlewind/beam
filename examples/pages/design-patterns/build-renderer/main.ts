// Design pattern: wrap beam-gpu in a tiny higher-level renderer abstraction.
// `MeshRenderer` owns the device, the pipelines and the scene; `Mesh` bundles a
// geometry's vertex/index buffers with a model matrix. The app code at the
// bottom never touches Beam directly — it just makes meshes and renders.
import { Beam } from 'beam-gpu'
import type { Pipeline } from 'beam-gpu'
import { createCamera } from '../../../shared/camera'
import {
  createBall,
  createBox,
  toWireframe,
  type Graphics,
} from '../../../shared/geometry'
import { create, translate, type Vec3 } from '../../../shared/mat4'
import normalWgsl from './normal.wgsl?raw'
import wireframeWgsl from './wireframe.wgsl?raw'

const sceneSchema = {
  modelMat: 'mat4',
  viewMat: 'mat4',
  projectionMat: 'mat4',
} as const

class Mesh {
  modelMat = create()
  verts
  triIndex
  wireIndex
  // One uniforms resource per pipeline schema (DESIGN §3.3): a mesh drawn in the
  // same frame as another must own its uniform buffers, or both read the last value.
  normalUniforms
  wireUniforms

  constructor(
    beam: Beam,
    normal: Pipeline,
    wire: Pipeline,
    { vertex, index }: Graphics
  ) {
    this.verts = beam.verts(normal.schema.vertex, vertex)
    this.triIndex = beam.index(index)
    this.wireIndex = beam.index(toWireframe(index))
    this.normalUniforms = beam.uniforms(normal.schema.uniforms)
    this.wireUniforms = beam.uniforms(wire.schema.uniforms)
  }

  translate(v: Vec3) {
    translate(this.modelMat, this.modelMat, v)
    return this
  }
}

class MeshRenderer {
  beam!: Beam
  normal!: Pipeline
  wireframe!: Pipeline
  wire = true
  meshes: Mesh[] = []
  cam = createCamera()

  // Async because device acquisition is async; `MeshRenderer.create(canvas)`.
  static async create(canvas: HTMLCanvasElement) {
    const r = new MeshRenderer()
    // depth: true gives the screen pass a depth attachment; the pipelines below
    // opt into matching depth state so the 3D scene occludes correctly.
    r.beam = await Beam.gpu(canvas, { depth: true })
    r.normal = r.beam.pipeline({
      wgsl: normalWgsl,
      vertex: { position: 'vec3', normal: 'vec3' },
      uniforms: sceneSchema,
      depth: true,
    })
    // less-equal so the overlay wins the z-test against the fill it shares
    // vertices with, while still being occluded by nearer geometry.
    r.wireframe = r.beam.pipeline({
      wgsl: wireframeWgsl,
      vertex: { position: 'vec3' },
      uniforms: sceneSchema,
      primitive: 'line',
      depth: { compare: 'less-equal' },
    })
    r.cam = createCamera({}, { canvas })
    return r
  }

  ballMesh() {
    return new Mesh(
      this.beam,
      this.normal,
      this.wireframe,
      createBall([0, 0, 0], 1, 50, 50)
    )
  }
  boxMesh() {
    return new Mesh(this.beam, this.normal, this.wireframe, createBox())
  }

  add(mesh: Mesh) {
    this.meshes.push(mesh)
    return mesh
  }

  setCamera(eye: Vec3, center?: Vec3, up?: Vec3) {
    this.cam = createCamera({ eye, center, up }, { canvas: this.beam.canvas })
  }

  render() {
    const { beam, normal, wireframe, cam, meshes } = this
    beam.frame(() => {
      beam.clear([0, 0, 0, 1])
      for (const mesh of meshes) {
        const scene = {
          modelMat: mesh.modelMat,
          viewMat: cam.viewMat,
          projectionMat: cam.projectionMat,
        }
        mesh.normalUniforms.set(scene)
        mesh.wireUniforms.set(scene)
        beam.draw(normal, {
          verts: mesh.verts,
          index: mesh.triIndex,
          uniforms: mesh.normalUniforms,
        })
        if (this.wire) {
          beam.draw(wireframe, {
            verts: mesh.verts,
            index: mesh.wireIndex,
            uniforms: mesh.wireUniforms,
          })
        }
      }
    })
  }
}

// --- App: the whole point is that this reads nothing like raw WebGPU. ---
const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const renderer = await MeshRenderer.create(canvas)
// renderer.wire = false // Try toggling the wireframe overlay!

const ball = renderer.add(renderer.ballMesh())
const box = renderer.add(renderer.boxMesh())
box.translate([-2, 0, -2])

renderer.setCamera([5, 5, 5])
renderer.render()
