---
title: Targets
---

# Targets

So far every draw has landed on the screen. A **target** is the same render
pass, pointed at an *offscreen* texture instead of the canvas. You draw into it
exactly the way you draw to the screen — `clear().draw(...)` — and then sample
its result in a later draw. That single idea unlocks post-processing, shadow
maps, reflections, and any multi-pass effect.

```ts
const target = beam.target({ width: 1024, height: 1024 })
```

A `Target` owns a sampleable color texture (`target.color`) and, when you ask
for it, a sampleable depth texture (`target.depth`). It records draws with the
same chainable verbs as the device, so nothing new to learn:

```ts
target.clear([0, 0, 0, 1]).draw(scene, { verts, index, uniforms })
```

## Creating a target

`beam.target(opts)` takes a small options object:

```ts
const target = beam.target({
  width: 1024,
  height: 1024,
  depth: true,            // also allocate a sampleable depth texture
  format: 'rgba8unorm',   // color format; defaults to the canvas format
  samples: 1,             // 1 (default) or 4 for MSAA
  label: 'scene'
})
```

- `width` / `height` are required — a target has no canvas to size itself from.
- `depth: true` adds `target.depth`. Leave it off for pure 2D / post passes.
- `format` defaults to `beam.format` (the preferred canvas format). Pick an
  explicit format when you need it, e.g. `'rgba16float'` for HDR.
- `samples: 4` turns on MSAA. Beam renders into an internal multisample
  texture and resolves into the single-sample `target.color`, so what you
  sample later is always resolved and sampleable.

## Drawing into a target

A target draws identically to `beam`. Inside a `frame`, clear it then record
draws — the recording API is the same `Target.clear` / `Target.draw` chain:

```ts
beam.frame(() => {
  // Pass 1 — render the scene into the offscreen color texture.
  target
    .clear([0, 0, 0, 1])
    .draw(scene, { verts, index, uniforms })

  // Pass 2 — draw to the screen, sampling pass 1's result.
  beam
    .clear()
    .draw(present, {
      verts: quadVerts,
      textures: { src: target.color },
      samplers: { samp }
    })
})
```

Both passes are encoded in one frame and submitted together. The order in which
you write the calls is the order they execute, so a target you draw into earlier
is ready to be sampled later in the same frame.

::: tip One target, two roles
`target.color` is a normal `Texture`. Hand it to a draw via
`bindings.textures` just like any image you loaded with `beam.texture(...)`.
For a depth target use `target.depth` (a `texture_depth_2d` in WGSL).
:::

## A complete two-pass example

Render a triangle offscreen, then sample it onto a full-screen quad on the
screen. The fragment shader inverts the colors as a stand-in for any
post-process.

```ts
import { Beam } from 'beam-gpu'
import sceneWgsl from './scene.wgsl?raw'
import postWgsl from './post.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 512
canvas.height = 512
const beam = await Beam.gpu(canvas)

// The offscreen surface we render the scene into.
const target = beam.target({ width: 512, height: 512 })

// Pass 1 pipeline: the familiar colored triangle.
const scene = beam.pipeline({
  wgsl: sceneWgsl,
  vertex: { position: 'vec3', color: 'vec3' }
})
const sceneVerts = beam.verts(scene.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const sceneIndex = beam.index({ array: [0, 1, 2] })

// Pass 2 pipeline: sample the target's color onto a quad.
const post = beam.pipeline({
  wgsl: postWgsl,
  vertex: { position: 'vec2' },
  textures: { src: 'tex2d' },
  samplers: { samp: 'sampler' }
})
const quad = beam.verts(post.schema.vertex, {
  position: [-1, -1, 1, -1, -1, 1, 1, 1]
})
const quadIndex = beam.index({ array: [0, 1, 2, 2, 1, 3] })
const samp = beam.sampler({ min: 'linear', mag: 'linear' })

beam.frame(() => {
  target
    .clear([0.1, 0.1, 0.1, 1])
    .draw(scene, { verts: sceneVerts, index: sceneIndex })

  beam
    .clear()
    .draw(post, {
      verts: quad,
      index: quadIndex,
      textures: { src: target.color },
      samplers: { samp }
    })
})
```

The post shader follows the WGSL conventions — one texture and one sampler in
`@group(1)`:

```wgsl
// post.wgsl
// vertex schema { position }        -> @location(0)
// textures { src }  + samplers { samp } -> @group(1)
@group(1) @binding(0) var src  : texture_2d<f32>;
@group(1) @binding(1) var samp : sampler;

struct VsOut {
  @builtin(position) pos : vec4f,
  @location(0)       uv  : vec2f,
};

@vertex
fn vs(@location(0) position : vec2f) -> VsOut {
  var out : VsOut;
  out.pos = vec4f(position, 0.0, 1.0);
  // Map clip space [-1,1] to UV [0,1]; flip Y so the image is upright.
  out.uv = vec2f(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  let c = textureSample(src, samp, in.uv);
  return vec4f(1.0 - c.rgb, 1.0); // invert as a sample post effect
}
```

## Multiple passes in one frame

Targets compose. Chain as many offscreen passes as the effect needs, each one
sampling the previous, and finish on the screen. Because everything is recorded
inside a single `frame`, intermediate textures never touch the canvas:

```ts
beam.frame(() => {
  sceneTarget.clear([0, 0, 0, 1]).draw(scene, sceneBindings)

  blurX
    .clear()
    .draw(blur, { verts: quad, index: quadIndex,
      textures: { src: sceneTarget.color }, samplers: { samp } })

  blurY
    .clear()
    .draw(blur, { verts: quad, index: quadIndex,
      textures: { src: blurX.color }, samplers: { samp } })

  beam
    .clear()
    .draw(present, { verts: quad, index: quadIndex,
      textures: { src: blurY.color }, samplers: { samp } })
})
```

## Ping-pong between two targets

Iterative effects — Gaussian blur, fluid sims, the classic Game of Life — read
one texture and write another, then swap. A target can't be sampled and written
in the same pass, so you keep **two** targets and ping-pong between them:

```ts
let read = beam.target({ width: 512, height: 512 })
let write = beam.target({ width: 512, height: 512 })

beam.loop(() => {
  // One simulation step: sample `read`, render into `write`.
  write
    .clear()
    .draw(step, {
      verts: quad,
      index: quadIndex,
      textures: { state: read.color },
      samplers: { samp }
    })

  // Present the freshly written state to the screen.
  beam
    .clear()
    .draw(present, {
      verts: quad,
      index: quadIndex,
      textures: { src: write.color },
      samplers: { samp }
    })

  // Swap: next frame reads what we just wrote.
  ;[read, write] = [write, read]
})
```

::: warning Sample a target, or write it — never both at once
A pass that reads `read.color` cannot also draw into `read`. Keep distinct read
and write targets and swap them. Sampler filtering should usually be `nearest`
for state textures (cellular automata, data passes) and `linear` for image
effects.
:::

## Resizing and cleanup

Targets are sized explicitly, so resize them yourself when the canvas changes:

```ts
window.addEventListener('resize', () => {
  beam.resize()
  target.resize(canvas.width, canvas.height)
})
```

When a target is no longer needed, free its GPU textures with `target.destroy()`.

## Migrating from old Beam

Old Beam created a target with positional `width, height` and redirected draws
with a `target.use(cb)` callback, then exposed a single `target.texture`:

```js
// Old (beam-gl)
const target = beam.target(2048, 2048)
beam.clear()
target.use(() => {
  beam
    .draw(shaderX, ...resourcesA)
    .draw(shaderY, ...resourcesB)
})
myTextures.set('img', target.texture)
```

In beam-gpu the options are keyed, the target *is* the draw surface (no `use`
wrapper — it has its own `clear`/`draw`), and color and depth are separate
sampleable textures:

```ts
// New (beam-gpu)
const target = beam.target({ width: 2048, height: 2048, depth: true })

beam.frame(() => {
  target
    .clear()
    .draw(shaderX, bindingsA)
    .draw(shaderY, bindingsB)

  // Sample the result in a later draw.
  beam.draw(present, {
    verts, index,
    textures: { img: target.color },   // was target.texture
    samplers: { samp }
  })
})
```

| Old beam-gl | beam-gpu |
|-------------|----------|
| `beam.target(w, h, depth)` | `beam.target({ width, height, depth?, format?, samples? })` |
| `target.use(cb)` | `target.clear().draw(pipe, bindings)` — same chain as `beam.draw` |
| `target.texture` | `target.color` (and `target.depth` for sampleable depth) |
| `textures.set('img', target.texture)` | `bindings.textures = { img: target.color }` |

For the power-path equivalent (your own command encoder, explicit
`pass.end()` / `submit()`), see [Frame & Loop](/guide/frame-and-loop) and
`beam.pass({ target })`.
