---
title: Getting Started
---

<script setup>
import wgsl from '../../examples/pages/basic-graphics/hello-world/hello.wgsl?raw'

// BeamCanvas hands us an already-initialized `beam` device plus the `canvas`.
// We only build the pipeline, the data, and draw one frame. This is the exact
// body of the walkthrough below, minus the `await Beam.gpu(canvas)` line
// (BeamCanvas already did that for us).
const setup = ({ beam }) => {
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

# Getting Started

This page takes you from an empty folder to a colorful triangle on screen. It's
the same hello-world that ships in Beam's examples, explained line by line.

Here's what we're building — a live one, running in your browser right now:

<BeamCanvas :setup="setup" :width="400" :height="400" />

## Requirements

Beam is **native WebGPU**, so you need a WebGPU-capable browser:

- **Chrome / Edge 113+** — enabled by default on Windows, macOS, and ChromeOS.
- **Safari 18+** (macOS Sequoia, iOS 18) — enabled by default.
- **Firefox** — available; enable `dom.webgpu.enabled` if needed.

You can check support at runtime with `navigator.gpu`. If it's missing, the
browser can't run WebGPU and Beam's `await Beam.gpu(canvas)` will reject.

```ts
if (!navigator.gpu) {
  throw new Error('WebGPU is not available in this browser.')
}
```

## Installation

```bash
npm i beam-gpu
```

Beam ships as an ES module with TypeScript types built in. It has no runtime
dependencies — it's a thin, honest wrapper over the WebGPU API.

```ts
import { Beam } from 'beam-gpu'
```

## Hello World

We'll render a triangle whose three corners are red, green, and blue, with the
GPU interpolating the colors across the face. Two files: a WGSL shader and a bit
of TypeScript. That's the whole app.

### The shader (`hello.wgsl`)

Beam never rewrites your shader — you hand-author one WGSL module with a `vs`
and an `fs` entry point. The bindings follow [Beam's WGSL
conventions](/guide/wgsl-conventions): vertex attributes map to `@location` in
schema-key order, and the uniform block lives at `@group(0) @binding(0)`.

```wgsl
// Colored triangle. Binding convention (DESIGN §4):
//   vertex schema { position, color } -> @location(0), @location(1)
//   uniforms schema { tint }          -> @group(0) @binding(0)
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

The vertex stage passes each vertex's `color` through; the fragment stage
receives the interpolated color and multiplies it by a global `tint` uniform
(white here, so the colors come through unchanged).

### The script (`main.ts`)

```ts
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
  uniforms: { tint: 'vec4' }
})

// Vertex buffers, keyed by attribute name (mutable via .set).
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

That's the entire program. Let's walk through what each step does.

### Step 1 — Get a canvas and size it

```ts
const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400
```

Beam draws into a `<canvas>` you own. Sizing is yours to control — Beam doesn't
touch it unless you opt into HiDPI with `Beam.gpu(canvas, { hidpi: true })`.

### Step 2 — Create the device

```ts
const beam = await Beam.gpu(canvas)
```

`Beam.gpu` is **async**: in one `await` it acquires the GPU adapter and device,
reads the canvas's preferred texture format, and configures the canvas context.
The returned `beam` is your handle for everything else. If you ever need the raw
WebGPU objects, they're right there: `beam.device`, `beam.adapter`, `beam.ctx`,
`beam.format`, `beam.canvas`.

### Step 3 — Build the pipeline

```ts
const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})
```

A `pipeline` pairs your WGSL module with **schemas** describing its inputs. From
this one declaration Beam derives three things: the TypeScript types, the GPU
vertex buffer layout (the `vertex` key order *is* the `@location` order), and the
bind group layouts (`uniforms` → `@group(0)`). The schemas are also surfaced as
`tri.schema.vertex` and `tri.schema.uniforms` so your resources stay in sync with
the pipeline.

### Step 4 — Make the data (resources)

```ts
const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })
```

Resources are persistent GPU objects you fill with plain arrays:

- **`beam.verts`** — one buffer per attribute, keyed by name. `position` holds
  three corners in clip space; `color` holds an RGB per corner (red, green,
  blue). Vertex count is inferred.
- **`beam.index`** — the triangle's vertex order `[0, 1, 2]`. Beam auto-selects
  `uint16` or `uint32` for you.
- **`beam.uniforms`** — one std140-packed uniform buffer. Here a single `tint`
  set to opaque white.

Every resource is mutable and chainable via `.set(...)`, so you can update data
later without rebuilding anything.

### Step 5 — Draw a frame

```ts
beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

`beam.frame(cb)` opens the per-frame command encoder, runs your callback, and
submits — it hides only the pure ceremony (encoder lifecycle and `queue.submit`).

Inside, two verbs do the work. `beam.clear([0, 0, 0, 1])` clears the screen to
black and returns `beam` so you can chain. `beam.draw(tri, { ... })` records one
draw: you hand it the pipeline and a single **keyed bindings object**. WebGPU
binds by group and index, not by name or order, so the data is one object —
`{ verts, index, uniforms }` — fully type-checked against `tri`'s schema.

And that's your triangle. From here, head to [Pipeline](/guide/pipeline) to go
deeper on schemas, or [Frame & Loop](/guide/frame-and-loop) to animate it.
