---
title: What is Beam?
---

# What is Beam?

Beam is a tiny, teachable WebGPU library. It is **not** a renderer or a 3D engine — it
ships no scene graph, no materials, no math library. Instead it gives you a handful of
honest abstractions over raw WebGPU, so you can write a triangle in a dozen lines and
still see exactly what the GPU is doing.

WebGPU is powerful but verbose: a triangle means an adapter, a device, a context,
a pipeline, bind group layouts, bind groups, a command encoder, a render pass, and a
queue submit. Just like jQuery once wrapped the DOM, Beam wraps WebGPU in a succinct
way — but without lying about the underlying model. Every Beam verb maps **1:1** to a
real WebGPU call, and every Beam handle exposes its raw object (`pipeline.gpu`,
`verts.buffers`, `beam.device`). When you outgrow Beam, you drop one level into plain
WebGPU without relearning anything.

## The mental model: five nouns, two verbs

WebGPU's real shape is `device → pipeline + bind groups → encoder → render pass → draw`.
Beam keeps every one of those visible, and hides only the two pieces that are pure
ceremony: the command-encoder lifecycle and `queue.submit`. What is left is **five
nouns** and **two verbs**.

| Noun | What it wraps | Created with |
| --- | --- | --- |
| **Beam** (device) | `GPUAdapter` + `GPUDevice` + canvas context | `await Beam.gpu(canvas)` |
| **Pipeline** | `GPURenderPipeline` + its bind group layouts | `beam.pipeline(template)` |
| **resources** | persistent `GPUBuffer` / `GPUTexture` / sampler | `beam.verts` / `beam.index` / `beam.uniforms` / `beam.texture` / `beam.sampler` |
| **Bindings** | the data for one draw (→ a `GPUBindGroup`) | a plain keyed object |
| **Target** | an offscreen render pass + sampleable texture | `beam.target(opts)` |

The two verbs are **`frame(cb)`**, which opens the per-frame command encoder, runs your
draws, and submits; and **`draw(pipeline, bindings)`**, which records one draw. The
everyday read is one line:

```ts
beam.frame(() =>
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
)
```

That is the whole API in miniature: make resources once, then describe each draw as a
pipeline plus a keyed `bindings` object. The keys (`verts`, `index`, `uniforms`,
`textures`, `samplers`) are checked by TypeScript against the pipeline's schema, so a
mismatched draw fails at compile time rather than as a cryptic GPU validation error.

## Hello, triangle

Here is a complete, colorful triangle. The pipeline declares its schema once; that one
declaration drives the TypeScript types, the vertex buffer layout, and the bind group
layouts.

```ts
import { Beam } from 'beam-gpu'
import wgsl from './hello.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

// Async init: adapter + device + context configuration in one await.
const beam = await Beam.gpu(canvas)

// A pipeline is WGSL plus schemas. Vertex key order is @location order;
// `tint` packs into the @group(0) uniform buffer.
const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})

// Resources are persistent GPU objects, mutable via .set().
const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })

// One frame: clear, then draw. The bindings object is type-checked against `tri`.
beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

The matching WGSL is hand-authored — Beam never rewrites or generates shader code. It
follows one fixed convention: vertex attributes become `@location`s in schema key order,
and uniforms become a single `@group(0) @binding(0)` struct.

```wgsl
// vertex schema { position, color } -> @location(0), @location(1)
// uniforms schema { tint }          -> @group(0) @binding(0)
struct Uniforms {
  tint : vec4f,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VsOut {
  @builtin(position) pos   : vec4f,
  @location(0)       color : vec3f,
};

@vertex
fn vs(
  @location(0) position : vec3f,
  @location(1) color    : vec3f,
) -> VsOut {
  var out : VsOut;
  out.pos = vec4f(position, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  return vec4f(in.color, 1.0) * u.tint;
}
```

Run it, and you get this — a live demo, rendered right here in your browser with real
beam-gpu and WebGPU:

<BeamCanvas :setup="triangle" />

<script setup>
import wgsl from './hello.wgsl?raw'

const triangle = async ({ beam }) => {
  const tri = beam.pipeline({
    wgsl,
    vertex: { position: 'vec3', color: 'vec3' },
    uniforms: { tint: 'vec4' }
  })
  const verts = beam.verts(tri.schema.vertex, {
    position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
    color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
  })
  const index = beam.index({ array: [0, 1, 2] })
  const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })
  beam.frame(() => {
    beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
  })
}
</script>

> The WGSL above is inlined into this page's demo as a string. In a real project you
> keep it in a `.wgsl` file and import it with `?raw`, exactly as the code sample shows.

## Why WebGPU?

The old Beam was built on WebGL — a 2010-era API modeled as a hidden global state
machine. WebGPU is the modern replacement, and it is a better teacher:

- **Explicit, validated objects** instead of implicit state. A pipeline bundles its
  shaders, vertex layout, and render state into one immutable object, so there is no
  stray state leaking between draws.
- **Bind groups** describe resources by `@group` and `@binding` index — a clear,
  cacheable contract between your data and your shaders.
- **WGSL**, a typed shading language designed for the modern GPU, replaces GLSL.
- It runs on Vulkan / Metal / D3D12 under the hood, and is shipping in Chrome, Edge,
  and Safari.

Beam embraces this model rather than hiding it. The one thing it removes — the
per-frame command-encoder dance — is the only part of WebGPU that has a single sensible
shape every frame. Everything else stays a first-class concept.

## How this differs from the old WebGL Beam

If you used the original `beam-gl`, the aesthetic is identical — "make data, then draw
it" — but the vocabulary is updated to WebGPU's real model:

| Old Beam (WebGL) | beam-gpu (WebGPU) |
| --- | --- |
| `new Beam(canvas)` | `await Beam.gpu(canvas)` — async adapter + device init |
| `beam.shader({ vs, fs })` (GLSL) | `beam.pipeline({ wgsl, ... })` (one WGSL module) |
| `beam.resource(Type, ...)` | named factories: `beam.verts` / `beam.index` / `beam.uniforms` / `beam.texture` |
| positional `draw(shader, ...resources)` | keyed `draw(pipeline, { verts, index, uniforms })` |
| implicit GL state machine | explicit per-frame encoder inside `beam.frame(cb)` |
| `beam.target(w, h)` + `target.use(cb)` | `beam.target(opts)` + `target.clear().draw(...)` |

Three differences are worth calling out. Init is **async**, because acquiring a GPU
adapter and device is async. A draw's data is a **keyed object**, not a positional
spread, because WebGPU binds by group and binding index, not by argument order — and the
keys let TypeScript check the call site. And **frames are explicit**: your draws live
inside `beam.frame(cb)` (or the rAF-driven `beam.loop(cb)`), which encodes and submits
one frame of work.

## Where to next

- [Getting Started](/guide/getting-started) — install beam-gpu and run the triangle in
  your own project.
- [Pipeline](/guide/pipeline) — how the schema drives types, vertex layout, and bind
  groups.
- [Resources](/guide/resources) — verts, index, uniforms, textures, and samplers.
- [Migrating from WebGL](/guide/migrating-from-webgl) — the full old-to-new map.
