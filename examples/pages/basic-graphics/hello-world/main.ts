import { Beam } from 'beam-gpu'
import wgsl from './hello.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

// Async init: adapter + device + context configuration in one await.
const beam = await Beam.gpu(canvas)

// Pipeline = WGSL + schemas. Vertex key order is @location order; `tint`
// packs into the @group(0) uniform buffer.
const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' },
})

// Vertex buffers, keyed by attribute name (mutable via .set).
const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1],
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })

// One frame: clear, then draw. The bindings object is type-checked against `tri`.
beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
