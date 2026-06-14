---
title: Resources
---

# Resources

A pipeline says *how* to draw. Resources are the *data* you draw with: vertices,
indices, uniforms, textures, samplers. In beam-gpu each one is a small, persistent
handle around a real `GPUBuffer`/`GPUTexture`/`GPUSampler` — you make it once, keep
it around, and mutate it cheaply with `.set(...)`.

There are six factories, all on the device:

```ts
beam.verts(schema, state?)   // → Verts<V>   — one GPUBuffer per attribute
beam.index(state)            // → Index      — uint16/uint32, auto-picked
beam.uniforms(schema, state?)// → Uniforms<U>— one std140-packed UBO
beam.texture(src?, opts?)    // → Texture
beam.cube(faces?, opts?)     // → Texture (cubemap)
beam.sampler(opts?)          // → Sampler    — immutable
```

You hand them to a draw as a single keyed `bindings` object, type-checked against the
pipeline:

```ts
beam.draw(pipe, { verts, index, uniforms, textures, samplers })
```

## The mutable `.set` model

Every data resource (everything except `Sampler`) is **mutable and chainable**.
`.set` writes to the existing GPU object and returns `this`, so you allocate once
and update in place every frame:

```ts
const uniforms = beam.uniforms(pipe.schema.uniforms, { tint: [1, 1, 1, 1] })

beam.loop((t) => {
  uniforms.set('tint', [Math.sin(t) * 0.5 + 0.5, 0.4, 0.8, 1])
  beam.clear().draw(pipe, { verts, index, uniforms })
})
```

Mutating contents reuses the same buffer — and therefore the same cached bind group.
Allocating a *new* resource makes a new bind group. That distinction matters for
multi-object scenes; see [One UBO per object](#one-ubo-per-object) below.

## Vertices — `beam.verts`

Vertex buffers are **non-interleaved**: one `GPUBuffer` per attribute, keyed by name.
The schema is usually just `pipe.schema.vertex`, so the keys and `@location` order
always line up with the pipeline:

```ts
const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' }, // @location(0), @location(1)
})

const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0,  0, 1, 0,  1, -1, 0],
  color:    [ 1,  0, 0,  0, 0, 1,  0, 1, 0],
})
```

`verts.count` is derived from the buffer sizes, so an unindexed `draw` knows how many
vertices to issue. Update a single attribute, or several at once:

```ts
verts.set('position', nextPositions)
verts.set({ position: p, color: c })
```

## Indices — `beam.index`

`beam.index({ array })` uploads an index buffer and **auto-selects** `uint16` or
`uint32` based on the largest index. Pass a plain `number[]` or a typed array:

```ts
const index = beam.index({ array: [0, 1, 2, 0, 2, 3] })
index.count   // 6
index.format  // 'uint16'
```

`count` and `offset` let you draw a sub-range; override them in `.set` when you reuse
one buffer for several slices:

```ts
index.set({ array: bigIndexData, offset: 1024, count: 256 })
```

If `bindings.index` is present the draw is indexed; if it's omitted the draw is
non-indexed and uses `verts.count`.

## Uniforms — `beam.uniforms`

A `Uniforms` resource is **one** std140-packed uniform buffer bound at
`@group(0) @binding(0)`. The schema mirrors your WGSL `struct` field order:

```ts
const uniforms = beam.uniforms(
  { model: 'mat4', view: 'mat4', proj: 'mat4', tint: 'vec4' },
  { tint: [1, 1, 1, 1] },
)
```

```wgsl
struct Uniforms {
  model : mat4x4f,
  view  : mat4x4f,
  proj  : mat4x4f,
  tint  : vec4f,
};
@group(0) @binding(0) var<uniform> u : Uniforms;
```

Set fields by key, by object, or all at once. Keys you don't touch keep their value:

```ts
uniforms.set('model', modelMatrix)
uniforms.set({ view: viewMatrix, proj: projMatrix })
```

### Nested structs — dotted keys

If your WGSL uniform contains nested structs, address their fields with dotted keys:

```wgsl
struct DirLight {
  direction : vec3f,
  color     : vec3f,
};
struct Uniforms {
  dirLight : DirLight,
  // ...
};
```

```ts
uniforms.set('dirLight.direction', [0, -1, 0])
uniforms.set('dirLight.color', [1, 0.95, 0.9])
```

### std140 / WGSL packing rules

beam-gpu computes every field's offset from the schema, so you don't hand-pad the
buffer — but you **do** have to declare your WGSL `struct` so its layout matches.
These are the rules Beam follows; follow the same ones in WGSL:

| Type   | Align | Size | Notes                                  |
| ------ | ----- | ---- | -------------------------------------- |
| scalar | 4     | 4    | `f32` / `i32` / `u32`                  |
| `vec2` | 8     | 8    |                                        |
| `vec3` | 16    | 12   | aligned to 16; trailing 4 bytes of pad |
| `vec4` | 16    | 16   |                                        |
| `mat2` | 16    | 16   | 2 × `vec2`, padded                     |
| `mat3` | 16    | 48   | 3 × `vec4` — **not** 36                |
| `mat4` | 16    | 64   |                                        |

Two traps worth memorizing:

**`vec3` carries 4 bytes of trailing padding.** Put a scalar right after a `vec3` and
it slots into that pad for free:

```wgsl
struct Uniforms {
  cameraPos : vec3f,  // offset 0,  size 12
  exposure  : f32,    // offset 12 — fills the vec3 pad, no waste
};
```

**`mat3` is 48 bytes, not 36.** Each of its three columns is padded to a `vec4`. Beam
handles this for you: when you `.set` a `mat3` you pass the natural **9 floats** and
Beam expands them to the 12-float padded layout.

```ts
uniforms.set('normalMatrix', nineFloatArray) // 9 in → 12 packed out
```

::: tip Prefer `mat4` for normal matrices
Because `mat3` padding is the single most common std140 mistake, the recommendation
(and what the gallery does) is to pass normal matrices as `mat4` where convenient and
read the upper-left `3x3` in WGSL. It sidesteps the trap entirely:

```ts
const uniforms = beam.uniforms({ normalMatrix: 'mat4' /* ... */ })
```

```wgsl
struct Uniforms { normalMatrix : mat4x4f, /* ... */ };
let n = mat3x3f(u.normalMatrix[0].xyz, u.normalMatrix[1].xyz, u.normalMatrix[2].xyz);
```
:::

In development builds Beam asserts the computed UBO size against the schema and warns
on any std140 mismatch, so a wrong WGSL struct surfaces immediately.

### One UBO per object

Every draw inside a `frame` is recorded into one command encoder and submitted
together, so all `queue.writeBuffer` writes land *before* any draw runs. If two
sequential draws share **one** `uniforms` resource, both read the **last** value you
wrote — not one value each.

So a multi-object scene allocates **one `uniforms` resource per object** (or a
per-object model-matrix uniform). This is WebGPU-correct, and Beam's identity-based
bind-group cache makes it cheap — distinct resources get distinct cached bind groups:

```ts
const balls = positions.map((p) => ({
  uniforms: beam.uniforms(pipe.schema.uniforms, { model: modelMatrix(p) }),
}))

beam.frame(() => {
  beam.clear()
  for (const ball of balls) beam.draw(pipe, { verts, index, uniforms: ball.uniforms })
})
```

## Textures — `beam.texture`

`beam.texture(source?, opts?)` makes a 2D texture. The source can be an `ImageBitmap`,
`HTMLImageElement`, `HTMLCanvasElement`, `HTMLVideoElement`, or raw
`{ data, width, height }`. Pass it now, or allocate empty and `.set` later (handy when
loading is async):

```ts
const img = await createImageBitmap(await (await fetch('/wood.png')).blob())
const albedo = beam.texture(img, { srgb: true, flipY: true, mips: true })

// or: allocate first, fill when the image arrives
const tex = beam.texture()
tex.set(img, { srgb: true })
```

### Texture options

| Option   | Meaning                                                                       |
| -------- | ----------------------------------------------------------------------------- |
| `srgb`   | Treat the image as sRGB-encoded color (`rgba8unorm-srgb`). Use for color maps; leave off for data maps (normal, roughness). |
| `flipY`  | Flip vertically on upload — match this to your UV convention.                  |
| `mips`   | Generate a full mip chain. Pair with a sampler whose `mip: 'linear'`.          |
| `format` | Override the texture format explicitly.                                        |
| `usage`  | Extra `GPUTextureUsageFlags` beyond the defaults.                              |

A `Texture` exposes `.gpu` (the `GPUTexture`), `.view` (a `GPUTextureView`), and
`.cube` (false here). You bind it by name under `bindings.textures`.

## Cubemaps — `beam.cube`

`beam.cube(faces?, opts?)` builds a cubemap from six sources, in WebGPU face order
`[+X, -X, +Y, -Y, +Z, -Z]`. Options are the same `TextureOpts`:

```ts
const sky = beam.cube([px, nx, py, ny, pz, nz], { srgb: true, mips: true })
```

In WGSL a cubemap is `texture_cube<f32>` and the schema type is `'texCube'`:

```ts
const env = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3' },
  textures: { sky: 'texCube' }, // → texture_cube<f32>
  samplers: { samp: 'sampler' },
})
```

## Samplers — `beam.sampler`

Samplers are **immutable**: there is no `.set`. To change filtering or wrapping you
make a new one. (Only `.gpu`, the underlying `GPUSampler`, is exposed.)

```ts
const linear = beam.sampler({
  wrap: 'repeat',  // or per-axis: ['repeat', 'clamp']
  mag: 'linear',
  min: 'linear',
  mip: 'linear',   // enables trilinear filtering when the texture has mips
})

const shadowSamp = beam.sampler({ compare: 'less' }) // → sampler_comparison
```

`wrap` accepts one `Wrap` for all axes or a per-axis tuple; values are `'repeat'`,
`'mirror'`, `'clamp'`. A `compare` function produces a comparison sampler
(`sampler_comparison` in WGSL) for shadow mapping.

## Binding textures and samplers

Textures and samplers live in `@group(1)`: textures first (in `textures` key order),
then samplers (in `samplers` key order). The pipeline schema fixes the binding
indices; you just supply matching keyed objects:

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', uv: 'vec2' },
  uniforms: { mvp: 'mat4' },
  textures: { albedo: 'tex2d' }, // @group(1) @binding(0)
  samplers: { samp: 'sampler' }, // @group(1) @binding(1)
})

beam.frame(() => {
  beam.clear().draw(pipe, {
    verts,
    index,
    uniforms,
    textures: { albedo },
    samplers: { samp: linear },
  })
})
```

```wgsl
@group(1) @binding(0) var albedo : texture_2d<f32>; // textures.albedo
@group(1) @binding(1) var samp   : sampler;         // samplers.samp

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  return textureSample(albedo, samp, in.uv);
}
```

## A complete live example

A colored triangle with an animated uniform, wired through the live demo host. The
`setup` function receives an already-initialized `beam` and the `canvas`, and returns
the `stop` from `beam.loop` for cleanup:

<BeamCanvas :setup="setup" />

```ts
import wgsl from './hello.wgsl?raw'

function setup({ beam }) {
  const tri = beam.pipeline({
    wgsl,
    vertex: { position: 'vec3', color: 'vec3' },
    uniforms: { tint: 'vec4' },
  })

  const verts = beam.verts(tri.schema.vertex, {
    position: [-1, -1, 0,  0, 1, 0,  1, -1, 0],
    color:    [ 1,  0, 0,  0, 1, 0,  0, 0, 1],
  })
  const index = beam.index({ array: [0, 1, 2] })
  const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })

  // mutate the uniform in place each frame; one allocation, one bind group
  return beam.loop((t) => {
    uniforms.set('tint', [Math.sin(t) * 0.5 + 0.5, 0.6, 0.9, 1])
    beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
  })
}
```

## Cleaning up

Every resource owns GPU memory. Long-lived apps that build resources dynamically
should call `.destroy()` when done (samplers are immutable and don't need it).
For a normal page that lives until navigation, `beam.destroy()` tears down the device
and everything with it.

## Next

- [Bindings and draw](/guide/bindings-and-draw) — how `bindings` becomes a bind group.
- [WGSL conventions](/guide/wgsl-conventions) — the full schema → WGSL mapping.
- [Pipeline](/guide/pipeline) — where these schemas come from.
