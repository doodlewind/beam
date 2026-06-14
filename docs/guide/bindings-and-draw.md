---
title: Bindings & Draw
---

# Bindings & Draw

In old Beam you drew with a positional spread:

```js
beam.draw(shader, vertexBuffers, indexBuffer, uniforms)
```

That worked because WebGL binds resources by name. WebGPU does not — it binds by
**group + binding index**. So beam-gpu replaces the spread with a single keyed
object, the **`Bindings`**, and that object is generically type-checked against
the pipeline you draw with:

```ts
beam.draw(pipe, { verts, index, uniforms, textures, samplers, instances })
```

One pipeline, one keyed bag of data, one draw. This page covers what goes in the
bag, how bind groups are built from it (the happy path and the power path), and
the one rule you must follow when a scene has more than one object.

## The Bindings object

A `Bindings` mirrors the pipeline's four schemas plus a couple of draw-time
knobs:

```ts
interface Bindings<V, U, T, S> {
  verts: Verts<V>            // required: one buffer per vertex attribute
  index?: Index             // optional: indexed draw
  uniforms?: Uniforms<U>    // the @group(0) UBO
  textures?: { [K in keyof T]: Texture }  // @group(1) textures, by key
  samplers?: { [K in keyof S]: Sampler }  // @group(1) samplers, by key
  instances?: number        // draw count only (default 1)
  groups?: BindGroup[]       // power path: pre-made bind groups
}
```

Because `draw` is generic over the pipeline, the keys are checked for you. Pass a
`Texture` where the pipeline declared a `tex2d`, miss a required `verts`, or
hand a `Uniforms` whose schema doesn't match, and it's a compile error — not a
runtime surprise.

```ts
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
```

Here's that exact program running live:

<BeamCanvas :setup="hello" />

<script setup>
const wgsl = `
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
`

const hello = ({ beam }) => {
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

::: tip Without an index
`index` is optional. Omit it and the draw uses `verts.count` vertices directly,
exactly like a non-indexed WebGPU draw. With it, the draw uses `index.count`
indices into the vertex buffers — the same reuse trick as old Beam's
`IndexBuffer`.
:::

## Adding textures and samplers

Textures and samplers are two separate keys, because in WGSL they are two
separate bindings under `@group(1)` (DESIGN §4). The pipeline declares them by
key; the `Bindings` supplies a `Texture` / `Sampler` resource under each key:

```ts
const box = beam.pipeline({
  wgsl: boxWgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { mvp: 'mat4' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' }
})

const tex = beam.texture(image)
const samp = beam.sampler({ wrap: 'repeat', min: 'linear', mag: 'linear' })

beam.frame(() => {
  beam.clear().draw(box, {
    verts,
    index,
    uniforms,
    textures: { img: tex },
    samplers: { samp }
  })
})
```

The keys (`img`, `samp`) line up with the pipeline schema, and TypeScript
enforces it. The binding **indices** inside `@group(1)` — textures first in key
order, then samplers — are derived for you; you never count them by hand.

## Where bind groups come from

A WebGPU draw needs `GPUBindGroup`s set on the pass before `draw`. beam-gpu
builds them for you from the keyed `Bindings`, against layouts derived from the
pipeline schema. There are two paths.

### Happy path — automatic and cached

You never name a bind group. `draw(pipe, bindings)` collects the `uniforms`,
`textures`, and `samplers` you passed, builds the bind groups, and **caches them
by resource identity** (DESIGN §3.4). Call `draw` every frame with the same
resources and the groups are created once and reused. Mutating a resource's
contents with `.set(...)` keeps the same buffer and the same cached group — only
allocating a *new* resource creates a new group.

This is the path you'll use almost everywhere. The hello-world above never says
the words "bind group."

### Power path — `beam.bind` and `pipe.group`

Sometimes you want a reusable, explicitly-named bind group — for instance to
share one `@group(0)` of camera uniforms across several pipelines, or to set a
group manually. `pipe.group(i)` hands you the typed `BindLayout` for group `i`;
`beam.bind(layout, entries)` makes a `BindGroup` keyed by binding index; you pass
it through `bindings.groups`:

```ts
const camLayout = pipe.group(0)
const camGroup = beam.bind(camLayout, { 0: cameraUniforms })

beam.frame(() => {
  beam.clear().draw(pipe, { verts, index, groups: [camGroup] })
})
```

`beam.bind` entries are keyed by raw binding index (`0`, `1`, …) and accept
beam resources or raw WebGPU objects (`GPUBuffer`, `GPUTextureView`,
`GPUSampler`) — it's the drop-down-a-level escape hatch. Groups you supply via
`bindings.groups` take precedence; anything you leave out is still auto-built
from the keyed fields. Reach for this only when the happy path can't express what
you need.

## The multi-object rule (read this twice)

This is the one place where WebGPU's model bites, and it's the most important
thing on the page.

**One `uniforms` resource per object.** (DESIGN §3.3)

Here's why. Every draw inside a single `frame` is recorded into one command
encoder and submitted **together**. Updating a `Uniforms` resource calls
`queue.writeBuffer` — and all of a frame's `writeBuffer` calls land *before* any
of the recorded draws execute on the GPU. So if you share one UBO across draws
and mutate it between them, every draw reads the **last** value written, not the
value that was set when you recorded it.

This is the trap — do **not** do this:

```ts
// BROKEN: all balls render at the LAST position.
const model = beam.uniforms(pipe.schema.uniforms)

beam.frame(() => {
  beam.clear()
  for (const ball of balls) {
    model.set('modelMat', ball.matrix)   // overwrites the shared buffer
    beam.draw(pipe, { verts, index, uniforms: model })
  }
})
```

All ten draws were recorded, then all ten `writeBuffer`s landed, then the GPU ran
the draws — every one reading the final `ball.matrix`. You get ten balls stacked
in one spot.

The fix is to give each object its **own** `uniforms` resource, allocated once,
up front:

```ts
// CORRECT: one uniforms resource per object.
const objects = balls.map(ball => ({
  ball,
  uniforms: beam.uniforms(pipe.schema.uniforms, { modelMat: ball.matrix })
}))

beam.frame(() => {
  beam.clear()
  for (const { uniforms } of objects) {
    beam.draw(pipe, { verts, index, uniforms })
  }
})
```

Distinct resources mean distinct buffers, distinct cached bind groups, and
therefore distinct values per draw — exactly what you want. To animate, mutate
each object's own resource with `.set(...)` (cheap, in place); just keep them
separate.

::: warning Why old Beam didn't have this rule
WebGL uploaded uniforms eagerly at each `draw`, so a shared resource reflected
whatever you'd last `.set`. WebGPU batches the whole frame, so per-object data
needs per-object resources. It's not Beam ceremony — it's how WebGPU actually
executes, and it's worth internalizing early.
:::

Shared, frame-constant data — the camera's view/projection matrices, a global
light — belongs in its **own** `uniforms` resource that you set once per frame
and reuse across every draw. Only the data that differs *per object* needs to be
per object. A common shape is one camera UBO at `@group(0)` plus a small
per-object model UBO.

## Recap

- A draw is `beam.draw(pipe, bindings)` — one keyed `Bindings`, type-checked
  against the pipeline.
- `verts` is required; `index`, `uniforms`, `textures`, `samplers`, `instances`,
  and `groups` are optional.
- Bind groups are built automatically and cached by resource identity. Drop to
  `pipe.group(i)` + `beam.bind(...)` + `bindings.groups` only when you need a
  named, reusable group.
- **One `uniforms` resource per object.** Per-object values demand per-object
  resources; share only the frame-constant uniforms.

Next: [Targets](/guide/targets) for offscreen rendering, then
[Frame & Loop](/guide/frame-and-loop) for animation.
