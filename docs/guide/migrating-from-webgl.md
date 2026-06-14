---
title: Migrating from WebGL
---

# Migrating from WebGL

If you have used the original Beam (`beam-gl`), you already know the whole mental
model: **make data, then draw it.** `beam-gpu` keeps that aesthetic, but it sits on
WebGPU instead of WebGL — so a few nouns get renamed, GLSL becomes WGSL, and two
concepts that WebGL hid (the command encoder and bind groups) become visible.

This page is a translation guide. Every old verb maps to a new one, almost
1:1. Read it top to bottom and your old renderers will port mechanically.

## The two conceptual shifts

Before the line-by-line map, two ideas changed shape. They are the only things you
have to *relearn*; everything else is a rename.

### 1. State machine → per-frame encoder

WebGL is a global state machine: you set state (`gl.useProgram`, `gl.bindBuffer`,
`gl.uniformMatrix4fv`), and `gl.drawElements` reads whatever is currently bound.
Old Beam hid this behind `beam.clear().draw(...)` — each call mutated GL state and
issued the draw immediately.

WebGPU records commands into a **command encoder**, then submits them all at once.
`beam-gpu` keeps that honest but removes the ceremony: you wrap your draws in
`beam.frame(cb)` (or `beam.loop(cb)`). Inside the callback, `clear` and `draw`
record into the frame's encoder; when the callback returns, Beam finishes and
submits.

```ts
// old beam-gl: each draw runs immediately
beam.clear().draw(shader, verts, index, uniforms)

// beam-gpu: draws are recorded inside a frame, then submitted together
beam.frame(() => {
  beam.clear().draw(pipe, { verts, index, uniforms })
})
```

One real consequence: because every draw in a frame submits together, all your
`uniforms.set(...)` writes land *before* any draw runs. Sequential draws that share
one `uniforms` resource would all read the **last** value written. So a multi-object
scene allocates one `uniforms` resource per object — see
[Frame & loop](/guide/frame-and-loop). In old Beam you got away with one `camera`
uniform and `camera.set('modelMat', ...)` between draws; under WebGPU that pattern is
no longer correct.

### 2. Name binding → bind groups

In WebGL, a uniform or sampler is found by **name**: `gl.getUniformLocation(prog,
'modelMat')`. Old Beam leaned on that — your shader key `modelMat` matched your
resource key `modelMat`, and a positional `...resources` spread filled them in.

WebGPU binds by **group + binding index**, not by name. So `beam-gpu` replaces the
positional spread with a single keyed `bindings` object, and the *positions* are
derived from your pipeline schema:

```ts
// old beam-gl: positional spread, matched by shader key names
beam.draw(shader, vertexBuffers, indexBuffer, uniforms, textures)

// beam-gpu: one keyed object, type-checked against the pipeline
beam.draw(pipe, { verts, index, uniforms, textures, samplers })
```

You almost never name a bind group: `draw` builds and caches them for you from the
keyed `bindings`. The convention that decides which group/binding each thing lands in
is fixed and small — see [WGSL conventions](/guide/wgsl-conventions).

## The migration map

Here is the full old → new table. The sections below expand the interesting rows.

| Old Beam (`beam-gl`)                            | `beam-gpu` equivalent                                            |
|-------------------------------------------------|------------------------------------------------------------------|
| `new Beam(canvas, config)`                      | `await Beam.gpu(canvas, config)` (alias `Beam.create`) — async   |
| `beam.gl`                                       | `beam.device` (+ `beam.adapter`, `beam.ctx`, `beam.format`)      |
| `beam.shader(template)`                         | `beam.pipeline(template)` → `Pipeline<V, U, T, S>`               |
| template `{ vs, fs }` (GLSL)                    | template `{ wgsl }` (one WGSL module); `vsEntry` / `fsEntry`     |
| template `buffers` schema                       | template `vertex` schema (keys → `@location` order)              |
| template `uniforms` schema                      | template `uniforms` schema (one std140 UBO at `@group(0)`)       |
| template `textures` schema                      | template `textures` + `samplers` schemas (→ `@group(1)`)         |
| template `mode`                                 | template `primitive: 'tri' \| 'tri-strip' \| 'line' \| 'point'`  |
| template `defines`                              | template `constants` (WGSL override constants)                   |
| `beam.resource(VertexBuffers, state)`           | `beam.verts(schema, state)` → `Verts<V>`                         |
| `beam.resource(IndexBuffer, { array })`         | `beam.index({ array, offset?, count? })` → `Index`               |
| `beam.resource(Uniforms, state)`               | `beam.uniforms(schema, state)` → `Uniforms<U>` (single UBO)      |
| `beam.resource(Textures, state)`                | `beam.texture(src, opts)` / `beam.cube(faces, opts)` + sampler   |
| `resource.set(key, val)`                        | `resource.set(key, val)` / `.set(obj)` — same chainable model    |
| `ResourceTypes` enum                            | removed (named factories — WebGPU has no such enum)              |
| `SchemaTypes.vec3` etc.                         | string literals `'vec3' \| 'mat4' \| 'f32' \| ...`               |
| `SchemaTypes.tex2D` / `texCube`                 | `'tex2d'` + `beam.texture` / `'texCube'` + `beam.cube`           |
| `beam.clear([r,g,b,a])`                         | `beam.clear([r,g,b,a], depth?)` — chainable                      |
| `beam.draw(shader, vbuf, ibuf, uniforms, tex)`  | `beam.draw(pipe, { verts, index, uniforms, textures, samplers })`|
| `beam.target(w, h, depth)`                      | `beam.target({ width, height, depth?, format?, samples? })`      |
| `target.use(cb)`                                | `target.clear().draw(pipe, bindings)` — same chain as `beam`     |
| `target.texture`                                | `target.color` (Texture) and `target.depth` (sampleable depth)   |
| `textures.set('img', target.texture)`           | `bindings.textures = { img: target.color }`                      |
| manual `requestAnimationFrame` loop             | `beam.loop((t, dt) => {...})` → `stop()`; or `beam.frame((t) => {...})` |
| implicit GL state machine                       | implicit per-frame encoder inside `frame` / `loop`               |

## Shader → Pipeline

`beam.shader` becomes `beam.pipeline`. The schema is nearly identical — `buffers`
becomes `vertex`, schema types become string literals, and the two GLSL strings
collapse into one WGSL module with `vs` and `fs` entry points.

```js
// old beam-gl — two GLSL strings + a schema object
import { SchemaTypes } from 'beam-gl'
const { vec3, vec4 } = SchemaTypes

const vs = `
attribute vec4 position;
attribute vec4 color;
varying highp vec4 vColor;
void main() {
  vColor = color;
  gl_Position = position;
}
`
const fs = `
varying highp vec4 vColor;
void main() { gl_FragColor = vColor; }
`

const shader = beam.shader({
  vs,
  fs,
  buffers: {
    position: { type: vec4, n: 3 },
    color: { type: vec4, n: 3 }
  }
})
```

```ts
// beam-gpu — one WGSL module + a typed schema
import wgsl from './hello.wgsl?raw'

const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})
```

### GLSL → WGSL

The shader language changes too. WGSL is more explicit, but the moves are
mechanical:

| GLSL                                  | WGSL                                            |
|---------------------------------------|-------------------------------------------------|
| `attribute vec4 position;`            | `@location(0) position : vec3f` (a `vs` param)  |
| `varying vec4 vColor;`                | a field on a returned `struct` (e.g. `VsOut`)   |
| `uniform mat4 modelMat;`              | a field of a `struct` at `@group(0) @binding(0)`|
| `gl_Position = ...`                   | `out.pos = ...` where `out.pos` is `@builtin(position)` |
| `gl_FragColor = ...`                  | `return ...` from a `@fragment fn -> @location(0) vec4f` |
| `texture2D(img, uv)`                  | `textureSample(img, samp, uv)` (explicit sampler) |

Here is the colored-triangle module from the hello-world, following the fixed
[WGSL conventions](/guide/wgsl-conventions) — uniforms struct first, then bindings,
then `@vertex`, then `@fragment`:

```wgsl
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

Note that in WebGPU, the sampler is a *separate* binding from the texture. A single
GLSL `sampler2D img` splits into a WGSL `texture_2d<f32>` plus a `sampler`, which is
why the pipeline schema gains a `samplers` field alongside `textures`.

## Resources → verts / index / uniforms / texture

The `beam.resource(Type, state)` factory and its `ResourceTypes` enum are gone.
Instead each resource kind has its own named factory. The `.set(...)` mutation model
is unchanged — same chainable, same dotted keys for nested structs.

```js
// old beam-gl
import { ResourceTypes } from 'beam-gl'
const { VertexBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const verts = beam.resource(VertexBuffers, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.resource(IndexBuffer, { array: [0, 1, 2] })
const camera = beam.resource(Uniforms, cameraMats)
const textures = beam.resource(Textures, { img: imageState })
```

```ts
// beam-gpu — named factories; schemas come from the pipeline
const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })

const img = beam.texture(image)
const samp = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })
```

Two things to notice:

- **Texture and sampler are split.** Old Beam's `Textures` resource carried both the
  image and its filtering/wrapping. In `beam-gpu`, `beam.texture(...)` is the image
  and `beam.sampler(...)` is the filtering — they bind separately into `@group(1)`.
  Samplers are immutable; to change filtering, make a new one.
- **One UBO per `uniforms` resource.** A `uniforms` resource is a single std140 UBO.
  For a multi-object scene, allocate one `uniforms` per object rather than mutating a
  shared one between draws (see the encoder shift above).

## Clear & draw

`clear` is unchanged in spirit — it sets the next pass's load color and returns
`this` so you can chain a `draw`. `draw`'s signature is where the keyed bindings
object replaces the positional spread.

```js
// old beam-gl — positional, immediate
beam
  .clear([0, 0, 0, 1])
  .draw(shader, verts, index, uniforms)
```

```ts
// beam-gpu — keyed bindings, recorded inside a frame
beam.frame(() => {
  beam
    .clear([0, 0, 0, 1])
    .draw(tri, { verts, index, uniforms })
})
```

The keys (`verts`, `index`, `uniforms`, `textures`, `samplers`, `instances`) are
type-checked against the pipeline `tri`, so a missing or mistyped resource is a
compile error rather than a silent blank screen.

### A live triangle

Here is the whole thing running. The `BeamCanvas` host has already done
`await Beam.gpu(canvas)` for you and passes in `{ beam, canvas }`:

<BeamCanvas :setup="({ beam }) => {
  const wgsl = `
    struct Uniforms { tint : vec4f, };
    @group(0) @binding(0) var<uniform> u : Uniforms;
    struct VsOut {
      @builtin(position) pos : vec4f,
      @location(0) color : vec3f,
    };
    @vertex fn vs(
      @location(0) position : vec3f,
      @location(1) color : vec3f,
    ) -> VsOut {
      var out : VsOut;
      out.pos = vec4f(position, 1.0);
      out.color = color;
      return out;
    }
    @fragment fn fs(in : VsOut) -> @location(0) vec4f {
      return vec4f(in.color, 1.0) * u.tint;
    }
  `
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
}" />

## Offscreen target

Old Beam's `beam.target(w, h, depth)` plus `target.use(cb)` becomes a `Target` object
that *itself* draws — the same `clear().draw(...)` chain as `beam`, so there is no
separate `use` scope to nest.

```js
// old beam-gl — nest draws inside target.use, then read target.texture
const target = beam.target(2048, 2048)
target.use(() => {
  beam.draw(shaderX, ...resourcesA)
})
myTextures.set('img', target.texture)
```

```ts
// beam-gpu — the target draws itself; read target.color
const target = beam.target({ width: 2048, height: 2048, depth: true })

beam.frame(() => {
  // draw the scene into the offscreen color texture
  target.clear().draw(pipeX, bindingsA)

  // then sample target.color in a screen pass
  beam.draw(post, {
    verts,
    index,
    textures: { img: target.color },
    samplers: { samp }
  })
})
```

The old `target.texture` is now `target.color` (a sampleable `Texture`), and a depth
target additionally exposes a sampleable `target.depth` — handy for shadow mapping,
where you bind `{ shadowMap: target.depth }`.

## Animation: rAF → loop

You no longer hand-write a `requestAnimationFrame` loop. `beam.loop(cb)` runs one for
you and returns a `stop()` function; the callback receives elapsed time `t` and
delta `dt` (both in seconds). Each tick is already wrapped in a frame, so you just
`clear` and `draw`.

```js
// old beam-gl — manual rAF, manual mutation between draws
const tick = () => {
  i += 0.02
  camera.set('viewMat', createCamera({ eye: [0, d, d] }).viewMat)
  beam.clear().draw(shader, ...buffers, camera)
  requestAnimationFrame(tick)
}
tick()
```

```ts
// beam-gpu — beam.loop owns the frame; returns stop()
const stop = beam.loop((t) => {
  uniforms.set('viewMat', createCamera({ eye: [0, d, d] }).viewMat)
  beam.clear().draw(pipe, { verts, index, uniforms })
})

// later: stop()
```

## Where to go next

- [Pipeline](/guide/pipeline) — the full template, presets, and schema → layout rules.
- [Resources](/guide/resources) — verts, index, uniforms, textures, samplers in depth.
- [Bindings & draw](/guide/bindings-and-draw) — the keyed bindings object and bind groups.
- [Frame & loop](/guide/frame-and-loop) — why one UBO per object, and the encoder model.
- [WGSL conventions](/guide/wgsl-conventions) — the fixed `@location` / `@group` rules.
