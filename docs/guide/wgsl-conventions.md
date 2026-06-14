---
title: WGSL Conventions
---

# WGSL Conventions

Beam never rewrites your shaders. You hand it one WGSL module, and it computes the
vertex buffer layouts and bind group layouts from the pipeline schema. In exchange,
your WGSL follows **one fixed convention** so the two sides line up. This page is the
complete reference for that convention.

The contract is small enough to memorize:

- **Vertex attributes** become `@location`s, in schema key order.
- **Uniforms** become one std140 struct at `@group(0) @binding(0)`.
- **Textures then samplers** live in `@group(1)`.

Everything below expands those three rules.

## One module, two entry points

A pipeline is a single WGSL module with a `vs` and an `fs` entry point. You author it
by hand and import it with `?raw`:

```ts
import wgsl from './hello.wgsl?raw'

const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})
```

The default entry-point names are `vs` and `fs`. Override them per pipeline with
`vsEntry` / `fsEntry` if you keep several techniques in one file.

## Vertex attributes → `@location`, in schema key order

The keys of the `vertex` schema map to `@location(0)`, `@location(1)`, … **in
declaration order**. There is one `GPUBuffer` per attribute (non-interleaved, stride =
attribute size, offset 0), so the order is purely about which `@location` each key
claims — not about packing.

Given this schema:

```ts
vertex: { position: 'vec3', color: 'vec3' }
```

`position` is `@location(0)` and `color` is `@location(1)`:

```wgsl
@vertex
fn vs(
  @location(0) position : vec3f,  // vertex.position
  @location(1) color    : vec3f,  // vertex.color
) -> VsOut { /* ... */ }
```

### Vertex type map

The schema type fixes both the WGSL type you write and the `GPUVertexFormat` Beam
derives for you. Vertex attributes accept scalars and vectors (matrices are uniforms,
not attributes):

| Schema type | WGSL type | GPUVertexFormat |
|-------------|-----------|-----------------|
| `'f32'`     | `f32`     | `float32`       |
| `'vec2'`    | `vec2f`   | `float32x2`     |
| `'vec3'`    | `vec3f`   | `float32x3`     |
| `'vec4'`    | `vec4f`   | `float32x4`     |
| `'i32'`     | `i32`     | `sint32`        |
| `'u32'`     | `u32`     | `uint32`        |

## Uniforms → `@group(0) @binding(0)`, one std140 UBO

All of a pipeline's uniforms pack into a **single** uniform buffer at
`@group(0) @binding(0)`. You declare a WGSL `struct` whose fields mirror the `uniforms`
schema order, and Beam packs `beam.uniforms(...)` writes to match.

```ts
uniforms: { tint: 'vec4' }
```

```wgsl
struct Uniforms {
  tint : vec4f,            // uniforms.tint
};
@group(0) @binding(0) var<uniform> u : Uniforms;
```

### Uniform type map

| Schema type | WGSL type   | std140 size | align |
|-------------|-------------|-------------|-------|
| `'f32'`     | `f32`       | 4           | 4     |
| `'i32'`     | `i32`       | 4           | 4     |
| `'u32'`     | `u32`       | 4           | 4     |
| `'vec2'`    | `vec2f`     | 8           | 8     |
| `'vec3'`    | `vec3f`     | 12          | 16    |
| `'vec4'`    | `vec4f`     | 16          | 16    |
| `'mat2'`    | `mat2x2f`   | 16          | 16    |
| `'mat3'`    | `mat3x3f`   | 48          | 16    |
| `'mat4'`    | `mat4x4f`   | 64          | 16    |

### std140 alignment, the parts that bite

WebGPU uniform buffers obey std140-style alignment. Two rules cover most of it:

- **A `vec3` aligns to 16 but only fills 12.** Put a scalar right after a `vec3` to
  occupy the trailing 4-byte pad — otherwise the next field skips to the following
  16-byte boundary and your offsets drift.
- **Matrices are column-padded.** `mat3` is **three `vec4` columns** (48 bytes, not 36);
  `mat2` is two `vec2` columns (16 bytes); `mat4` is a tidy 64 bytes. When you
  `.set('normalMatrix', m)` a `mat3`, you pass the natural 9 floats and Beam expands them
  to the 12-float padded layout for you.

```wgsl
struct Uniforms {
  model      : mat4x4f,   // uniforms.model       — 64 bytes
  normalMat  : mat3x3f,   // uniforms.normalMatrix — 48 bytes (3x vec4)
  lightDir   : vec3f,     // uniforms.lightDir     — aligns to 16, fills 12...
  intensity  : f32,       // uniforms.intensity    — ...this fills the pad
};
@group(0) @binding(0) var<uniform> u : Uniforms;
```

::: tip Dodge the mat3 trap
A `mat3` normal matrix is the classic std140 footgun. Where it is convenient, declare it
as a `mat4` in both schema and WGSL and pass the matrix as 16 floats — the padding
disappears.
:::

Nested structs are addressed with **dotted keys** on `.set`:

```ts
uniforms.set('dirLight.direction', [0, -1, 0])
```

```wgsl
struct DirLight {
  direction : vec3f,
  intensity : f32,
};
struct Uniforms {
  dirLight : DirLight,    // uniforms.dirLight.*
};
@group(0) @binding(0) var<uniform> u : Uniforms;
```

In dev mode Beam compares the computed UBO size to the schema and warns on a std140
mismatch, so a misordered struct is caught early.

## Textures then samplers → `@group(1)`

Textures and samplers share `@group(1)`. **Textures come first** — `@binding(0)` through
`@binding(T-1)` in `textures` key order — then samplers continue at `@binding(T)`
through `@binding(T+S-1)` in `samplers` key order.

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', uv: 'vec2' },
  uniforms: { mvp: 'mat4' },
  textures: { albedo: 'tex2d', normal: 'tex2d' },
  samplers: { samp: 'sampler' }
})
```

With two textures (`T = 2`) and one sampler, the bindings are:

```wgsl
@group(1) @binding(0) var albedo : texture_2d<f32>;   // textures.albedo
@group(1) @binding(1) var normal : texture_2d<f32>;   // textures.normal
@group(1) @binding(2) var samp   : sampler;           // samplers.samp
```

### Texture & sampler type map

| Schema type        | WGSL type              |
|--------------------|------------------------|
| `'tex2d'`          | `texture_2d<f32>`      |
| `'texCube'`        | `texture_cube<f32>`    |
| `'texDepth'`       | `texture_depth_2d`     |
| `'sampler'`        | `sampler`              |
| `'samplerCompare'` | `sampler_comparison`   |

## File layout convention

Keep one `.wgsl` per pipeline, imported with `?raw`, and order the module top-to-bottom:

1. The `Uniforms` struct (and any nested structs it needs).
2. The `@group(0)` / `@group(1)` bindings.
3. The `@vertex` entry point.
4. The `@fragment` entry point.

Comment each binding with the schema key it mirrors. That single habit is what keeps the
WGSL side and the TypeScript side honestly in sync.

## Complete annotated example

Here is a full, self-contained pipeline that exercises every group: vertex attributes, a
uniform struct (with a deliberate scalar-after-`vec3`), one texture, and one sampler.

The TypeScript:

```ts
import { Beam } from 'beam-gpu'
import wgsl from './lit.wgsl?raw'

const beam = await Beam.gpu(canvas)

const lit = beam.pipeline({
  wgsl,
  // keys -> @location(0), @location(1), @location(2)
  vertex: { position: 'vec3', normal: 'vec3', uv: 'vec2' },
  // one std140 UBO at @group(0) @binding(0)
  uniforms: { mvp: 'mat4', lightDir: 'vec3', ambient: 'f32' },
  // textures then samplers, both in @group(1)
  textures: { albedo: 'tex2d' },
  samplers: { samp: 'sampler' }
})
```

The matching `lit.wgsl` — note how each binding's comment names its schema key:

```wgsl
// lit.wgsl — binding convention (DESIGN §4)
//   vertex   { position, normal, uv } -> @location(0,1,2)
//   uniforms { mvp, lightDir, ambient } -> @group(0) @binding(0)
//   textures { albedo } + samplers { samp } -> @group(1) @binding(0,1)

struct Uniforms {
  mvp      : mat4x4f,   // uniforms.mvp      — 64 bytes
  lightDir : vec3f,     // uniforms.lightDir — aligns 16, fills 12...
  ambient  : f32,       // uniforms.ambient  — ...fills the vec3 pad
};
@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var albedo : texture_2d<f32>;  // textures.albedo
@group(1) @binding(1) var samp   : sampler;          // samplers.samp

struct VsOut {
  @builtin(position) pos    : vec4f,
  @location(0)       normal : vec3f,
  @location(1)       uv     : vec2f,
};

@vertex
fn vs(
  @location(0) position : vec3f,  // vertex.position
  @location(1) normal   : vec3f,  // vertex.normal
  @location(2) uv       : vec2f,  // vertex.uv
) -> VsOut {
  var out : VsOut;
  out.pos = u.mvp * vec4f(position, 1.0);
  out.normal = normal;
  out.uv = uv;
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  let base = textureSample(albedo, samp, in.uv).rgb;
  let diffuse = max(dot(normalize(in.normal), -u.lightDir), 0.0);
  return vec4f(base * (u.ambient + diffuse), 1.0);
}
```

That is the whole convention. Once the schema and the WGSL agree on order, Beam's derived
layouts and your hand-written shader meet exactly in the middle — and a draw call's
`bindings` object is fully type-checked against the pipeline.

## See also

- [Pipeline](/guide/pipeline) — the schema that drives these layouts.
- [Resources](/guide/resources) — `verts`, `uniforms`, `texture`, `sampler`.
- [Bindings & Draw](/guide/bindings-and-draw) — handing this data to a draw.
