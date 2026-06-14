---
title: Pipeline
---

# Pipeline

A pipeline is the recipe for one kind of draw. `beam.pipeline(template)` takes a
single declaration — your hand-authored WGSL plus a few schemas — and gives you
back a `Pipeline<V, U, T, S>` that knows three things at once:

- the **TypeScript types** of the data each draw needs,
- the **vertex buffer layout** (strides, offsets, formats), and
- the **bind group layouts** (which uniforms, textures, and samplers live where).

This is the heir to old Beam's `beam.shader(template)`. The big shift: in WebGPU
you write one WGSL module by hand, and Beam never rewrites it. Beam only derives
layouts *around* your shader, from the schemas you declare.

## The smallest pipeline

```ts
import { Beam } from 'beam-gpu'
import wgsl from './hello.wgsl?raw'

const beam = await Beam.gpu(canvas)

const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})
```

That's it. `tri` is now a fully typed `Pipeline`. The `vertex`, `uniforms`,
`textures`, and `samplers` keys are the **schema**; everything else in the
template is a fixed-function preset with a sensible default.

<BeamCanvas :setup="async ({ beam }) => {
  const wgsl = `
struct U { tint: vec4f };
@group(0) @binding(0) var<uniform> u: U;
struct VsOut { @builtin(position) pos: vec4f, @location(0) color: vec3f };
@vertex fn vs(@location(0) position: vec3f, @location(1) color: vec3f) -> VsOut {
  var o: VsOut; o.pos = vec4f(position, 1.0); o.color = color; return o;
}
@fragment fn fs(in: VsOut) -> @location(0) vec4f {
  return vec4f(in.color, 1.0) * u.tint;
}`
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

## The schema drives everything

The schema is four optional records (only `vertex` is required). Each maps a
field name to a type string from the [schema vocabulary](/guide/wgsl-conventions).
Key **order** matters: it pins down `@location` and `@binding` indices.

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex:   { position: 'vec3', normal: 'vec3', uv: 'vec2' },
  uniforms: { mvp: 'mat4', tint: 'vec4' },
  textures: { albedo: 'tex2d' },
  samplers: { samp: 'sampler' }
})
```

### `vertex` → vertex layout + `@location`

Each vertex field is one non-interleaved vertex buffer. The field's position in
the record becomes its `@location`:

| schema key | type    | `@location` | WGSL type | format     |
|------------|---------|-------------|-----------|------------|
| `position` | `vec3`  | `0`         | `vec3f`   | `float32x3`|
| `normal`   | `vec3`  | `1`         | `vec3f`   | `float32x3`|
| `uv`       | `vec2`  | `2`         | `vec2f`   | `float32x2`|

So your `@vertex` entry reads attributes in exactly this order:

```wgsl
@vertex
fn vs(
  @location(0) position : vec3f,  // vertex.position
  @location(1) normal   : vec3f,  // vertex.normal
  @location(2) uv       : vec2f,  // vertex.uv
) -> VsOut { /* ... */ }
```

Vertex schemas only accept scalar and vector types — no matrices. One buffer per
attribute, no interleaving, no per-instance attributes; `instances` is a draw
count only.

### `uniforms` → one UBO at `@group(0) @binding(0)`

All uniform fields pack into a **single** std140 uniform buffer, declared as one
WGSL `struct` in schema-key order:

```wgsl
struct Uniforms {
  mvp  : mat4x4f,  // uniforms.mvp
  tint : vec4f,    // uniforms.tint
};
@group(0) @binding(0) var<uniform> u : Uniforms;
```

Matrices and `vec3` carry std140 alignment traps (a `mat3` is three padded
`vec4`s, 48 bytes; a `vec3` wants a scalar tucked after it). The
[WGSL conventions](/guide/wgsl-conventions) page lists the full alignment table.

### `textures` then `samplers` → `@group(1)`

Textures get `@binding(0..T-1)` in `textures` key order; samplers follow at
`@binding(T..)` in `samplers` key order — all in `@group(1)`:

```wgsl
@group(1) @binding(0) var albedo : texture_2d<f32>;  // textures.albedo
@group(1) @binding(1) var samp   : sampler;          // samplers.samp
```

Because Beam builds these layouts from your schema (never `layout: 'auto'`),
bind groups are reusable across any pipeline that shares the same schema.

## Schemas feed your resources

The schema isn't just for WGSL — pass it straight into the resource factories so
your data is typed against the pipeline:

```ts
const verts = beam.verts(pipe.schema.vertex, {
  position: positions,
  normal: normals,
  uv: uvs
})
const uniforms = beam.uniforms(pipe.schema.uniforms, { tint: [1, 1, 1, 1] })
```

Then the `bindings` object you hand to `draw` is fully type-checked against the
pipeline:

```ts
beam.frame(() => {
  beam.clear().draw(pipe, { verts, index, uniforms, textures: { albedo }, samplers: { samp } })
})
```

See [Resources](/guide/resources) and [Bindings & Draw](/guide/bindings-and-draw)
for the data side.

## Fixed-function presets

Everything outside the schema configures the fixed-function stages. All are
optional and default to the common case (an opaque, depth-tested triangle list
drawn to the canvas format):

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3' },

  primitive: 'tri',         // 'tri' | 'tri-strip' | 'line' | 'point'
  cull: 'back',             // 'none' | 'back' | 'front'
  depth: true,              // boolean | { test, write, compare, format }
  blend: 'alpha',           // 'none' | 'alpha' | 'add'
  samples: 4,               // 1 | 4 — MSAA
  vsEntry: 'vs',            // override the @vertex entry name
  fsEntry: 'fs',            // override the @fragment entry name
  constants: { LIGHTS: 3 }, // WGSL override constants
  label: 'lit'
})
```

| Preset       | Default              | Notes                                                   |
|--------------|----------------------|---------------------------------------------------------|
| `primitive`  | `'tri'`              | Triangle list, strip, line, or point list.              |
| `cull`       | `'none'`             | Back/front face culling.                                |
| `depth`      | `false`              | `true` enables a depth attachment; or pass `DepthOpts`. |
| `blend`      | `'none'`             | `'alpha'` for transparency, `'add'` for additive.       |
| `targets`    | one canvas-format target | `ColorTarget[]` for MRT or per-target blend.        |
| `samples`    | `1`                  | `4` enables MSAA (Beam manages the resolve).            |
| `constants`  | none                 | WGSL `override` constants, replacing GLSL `defines`.    |
| `vsEntry` / `fsEntry` | `'vs'` / `'fs'` | Rename the entry points Beam looks for.            |

### `depth` in detail

`depth: true` is shorthand for the usual "test and write with `less`". For shadow
passes or read-only depth, pass the object form:

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3' },
  depth: { test: true, write: false, compare: 'less-equal' }
})
```

### `blend` and `targets`

`blend` is a shortcut for the single default color target. For multiple render
targets, or to mix formats and blend modes per attachment, spell out `targets`:

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3' },
  targets: [
    { format: 'rgba8unorm', blend: 'alpha' },
    { format: 'rgba16float' }
  ]
})
```

## WGSL is hand-authored

Beam never generates or rewrites your shader. You write one WGSL module with a
`@vertex` and a `@fragment` entry (named `vs` / `fs` by default), and you follow
**one fixed convention** so your `@location` and `@group`/`@binding` indices line
up with the schema Beam derived. Import it with `?raw`:

```ts
import wgsl from './lit.wgsl?raw'
const pipe = beam.pipeline({ wgsl, vertex: { position: 'vec3' } })
```

The full convention — type maps, std140 alignment, binding order, and the
recommended file structure — lives in
[WGSL Conventions](/guide/wgsl-conventions). Read it before writing your first
shader; it's the contract that keeps your hand-written WGSL and your schema in
agreement.
