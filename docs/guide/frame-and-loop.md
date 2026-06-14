---
title: Frame & Loop
---

# Frame & Loop

You have a pipeline, some resources, and a `draw` call. The last question is
*when* it runs. WebGPU never draws "right now" — it records commands into an
encoder and submits them as a batch. Beam keeps that model honest, but hides the
two pieces that are pure ceremony.

## A frame is a function

Raw WebGPU makes you spell out the same six steps every frame:

```ts
const encoder = device.createCommandEncoder()
const pass = encoder.beginRenderPass({ /* ...attachments... */ })
// ...record draws...
pass.end()
device.queue.submit([encoder.finish()])
```

Two of those steps — creating/finishing the encoder and `queue.submit` — have
exactly one sensible shape per frame. `beam.frame(cb)` removes *only* those:

```ts
beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

Inside the callback the encoder is open; when it returns, Beam finishes and
submits. Everything you do between is recorded into that one frame. The callback
receives the current timestamp (a `DOMHighResTimeStamp` in milliseconds), handy
for animation:

```ts
beam.frame((t) => {
  uniforms.set('time', t / 1000)
  beam.clear().draw(tri, { verts, index, uniforms })
})
```

### What `frame` hides — and what it does not

`frame` hides the **encoder** and the **submit**. It does *not* hide the render
**pass**. That is deliberate: the pass is a real WebGPU concept, and pretending
it didn't exist would teach you WebGPU wrong.

The pass is just kept implicit on the happy path. The first time you draw to the
screen inside a frame, Beam opens the default screen pass for you; `beam.clear()`
sets its `loadOp`. An offscreen pass, by contrast, is an explicit [`Target`](/guide/targets)
— you opt into it by name. So:

- Encoder lifecycle + submit — **hidden** (one shape per frame).
- The screen render pass — **implicit but present** (it's what `clear().draw()`
  records into).
- An offscreen pass — **explicit** (`beam.target(...)`).

## Animating with `loop`

A single frame is rarely enough. `beam.loop(cb)` runs your callback on a
`requestAnimationFrame` loop and returns a `stop()` function. Each tick gets the
timestamp `t` and the delta `dt` since the previous frame (both in
milliseconds):

```ts
const stop = beam.loop((t, dt) => {
  uniforms.set('time', t / 1000)
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})

// Later, to tear down:
stop()
```

Each tick is its own `frame`: the encoder opens, your draws record, and Beam
submits — then waits for the next animation frame. You never manage `rAF`
handles or call `cancelAnimationFrame`; `stop()` does it.

Here is a live spinning triangle, rotated in the shader by a `time` uniform:

<BeamCanvas :setup="setup" />

```ts
import { Beam } from 'beam-gpu'
import wgsl from './spin.wgsl?raw'

const beam = await Beam.gpu(canvas)

const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { time: 'f32' }
})

const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms)

const stop = beam.loop((t) => {
  uniforms.set('time', t / 1000)
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

```wgsl
// spin.wgsl
struct Uniforms {
  time : f32,
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
  let a = u.time;
  let r = mat2x2f(cos(a), -sin(a), sin(a), cos(a));
  var out : VsOut;
  out.pos = vec4f(r * position.xy, position.z, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  return vec4f(in.color, 1.0);
}
```

## Clear and loadOp defaults

By default, every surface starts each frame cleared to black. The rules
(DESIGN §3.6):

- `beam.clear()` with no arguments clears to `[0, 0, 0, 1]`, depth `1`.
- If you draw to a surface in a frame *without* calling `clear()` first, its
  first pass that frame still uses `loadOp: 'clear'` to `[0, 0, 0, 1]` — so you
  never accidentally read stale framebuffer contents.
- Once a pass is open, subsequent draws into it `load` (accumulate) rather than
  re-clearing.
- An explicit `clear(color)` overrides the color; pass a second argument to set
  the depth clear value.

```ts
beam.frame(() => {
  beam
    .clear([0.1, 0.1, 0.12, 1]) // clear once, to a dark slate
    .draw(tri, { verts, index, uniforms })
    .draw(tri2, { verts: verts2, index: index2, uniforms: uniforms2 }) // loads
})
```

`clear` returns the device, so it chains straight into `draw`. The same chain
works on a [`Target`](/guide/targets) via `target.clear().draw(...)`.

## The power path: `beam.pass()`

`frame` + `clear` + `draw` covers everything in the gallery. When you need
control that the implicit pass doesn't expose — multiple passes per encoder, a
viewport or scissor rect, or driving submission yourself — drop one level to
`beam.pass()`.

`beam.pass(opts?)` returns a `Pass`: a thin wrapper over a real
`GPURenderPassEncoder` (reachable as `pass.gpu`, with `pass.encoder` for the
underlying `GPUCommandEncoder`). You record into it and finish it yourself:

```ts
const pass = beam.pass({ clear: [0, 0, 0, 1] })
pass
  .viewport(0, 0, 200, 400)
  .draw(tri, { verts, index, uniforms })
  .end()
  .submit()
```

`PassOpts` lets you point the pass at an offscreen `Target`, set the clear color
(or `null` to `load` instead of clear), set `clearDepth`, or reuse an existing
`GPUCommandEncoder`:

```ts
interface PassOpts {
  target?: Target                                   // offscreen, default screen
  clear?: [number, number, number, number] | null   // null = loadOp 'load'
  clearDepth?: number | null
  encoder?: GPUCommandEncoder                         // share an encoder
}
```

A `Pass` exposes `clear()`, `draw()`, `viewport()`, `scissor()`, `end()`, and
`submit()`. You are now responsible for the lifecycle `frame` was handling —
call `end()` to close the pass and `submit()` to flush the encoder. If you pass
your own `encoder`, you can record several passes into it and `submit()` once.

The two layers are the same model at different altitudes:

| You want…                                  | Use                          |
|--------------------------------------------|------------------------------|
| One screen frame, terse                    | `beam.frame(() => …)`        |
| An animation loop                          | `beam.loop((t, dt) => …)`    |
| Offscreen render-to-texture                | `beam.target(opts)`          |
| Viewport/scissor, multi-pass, manual submit| `beam.pass(opts)`            |

Reach for `pass()` when you've outgrown `frame`, not before — and even then,
`pass.gpu` and `pass.encoder` are right there when you need raw WebGPU.

<script setup>
import wgsl from '../.vitepress/snippets/spin.wgsl?raw'

const setup = async ({ beam, canvas }) => {
  const tri = beam.pipeline({
    wgsl,
    vertex: { position: 'vec3', color: 'vec3' },
    uniforms: { time: 'f32' }
  })
  const verts = beam.verts(tri.schema.vertex, {
    position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
    color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
  })
  const index = beam.index({ array: [0, 1, 2] })
  const uniforms = beam.uniforms(tri.schema.uniforms)

  return beam.loop((t) => {
    uniforms.set('time', t / 1000)
    beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
  })
}
</script>
