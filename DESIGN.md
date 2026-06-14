# beam-gpu — DESIGN.md (LOCKED)

`beam-gpu` is the WebGPU-native rewrite of Beam: a tiny, terse, teachable graphics
library. It keeps Beam's "make data, then draw it" aesthetic while honestly exposing
WebGPU's real model. You can write a triangle in a dozen lines, then drop one level
into raw WebGPU without relearning anything — every Beam verb maps 1:1 to a real
WebGPU call, and every handle exposes its raw object.

---

## 1. Mental model — five honest nouns + two verbs

WebGPU's structure is `device → pipeline + bind groups → encoder → render pass → draw`.
Beam keeps every one of those visible, but hides the two pieces that are pure ceremony
(command-encoder lifecycle and `queue.submit`). The result is **five nouns** and
**two drawing verbs**:

| Beam noun        | What it wraps                              | Old Beam ancestor          |
|------------------|--------------------------------------------|----------------------------|
| `Beam` (device)  | `GPUAdapter` + `GPUDevice` + canvas context| `new Beam(canvas)`         |
| `Pipeline`       | `GPURenderPipeline` + derived layouts      | `beam.shader(template)`    |
| resources        | persistent `GPUBuffer`/`GPUTexture`/sampler| `beam.resource(Type, ...)` |
| `Bindings`       | the data you hand one draw (→ `GPUBindGroup`)| the `...resources` spread |
| `Pass` / `Target`| a `GPURenderPassEncoder` / RTT attachment  | `beam.clear` / `beam.target`|

Two verbs: **`frame(cb)`** opens the per-frame command encoder, runs your draws, and
submits — and **`draw(pipeline, bindings)`** records one draw.

The terse everyday read mirrors the old gallery, one-for-one:

```ts
beam.frame(() =>
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
)
```

### Why `frame` exists (and the render PASS does not hide)
WebGPU forces: `createCommandEncoder()` → `beginRenderPass()` → `...record...` →
`pass.end()` → `encoder.finish()` → `queue.submit()`. Two of those — encoder
create/finish and `queue.submit` — are pure ceremony with one sensible shape per frame.
Beam removes ONLY those, inside `frame(cb)`: "a frame is a function." The **render pass
stays a first-class concept**: the default screen pass is what `beam.clear().draw(...)`
records into, and an offscreen pass is an explicit `Target`. We deliberately do not
pretend passes don't exist — that would teach WebGPU wrong.

### Why `Bindings` is a keyed object, not a positional spread
WebGPU binds by **group + binding index**, not by name or order. So a draw's data is a
single keyed object, generic over the pipeline schema so the call site is fully
type-checked:

```ts
beam.draw(pipe, { verts, index, uniforms, textures, samplers, instances })
```

### Where bind groups live (visible, but cheap)
- **Happy path:** you never name a bind group. `draw(pipe, bindings)` builds (and caches
  by resource identity) the bind groups from the keyed `bindings`, against layouts
  *derived from the pipeline schema*.
- **Power path:** `pipe.group(i)` returns a typed `BindLayout`; `beam.bind(layout, {...})`
  makes a reusable named `BindGroup` you pass via `bindings.groups`.

---

## 2. Core concepts

### 2.1 `Beam` — the device (async init)
`await Beam.gpu(canvas, config?)` (alias `Beam.create`) acquires adapter + device, reads
`navigator.gpu.getPreferredCanvasFormat()`, configures the canvas context. Escape
hatches: `beam.device`, `beam.adapter`, `beam.ctx`, `beam.format`, `beam.canvas`.

### 2.2 `Pipeline` — `beam.pipeline(template)` (replaces `beam.shader`)
The schema drives three outputs from one declaration: TS types (`Pipeline<V,U,T,S>`),
`GPUVertexBufferLayout` (strides/offsets/formats from `vertex` key order == `@location`
order), and explicit `GPUBindGroupLayout`s (uniforms → `@group(0)`, textures+samplers →
`@group(1)`). **Never `layout: 'auto'`** (cross-pipeline incompatibility footgun) — we
build layouts from the schema so bind groups are reusable across pipelines sharing a
schema. WGSL is hand-authored, never rewritten. Fixed-function presets: `primitive`,
`cull`, `depth`, `blend`, `targets`, `samples`, `constants`, `vsEntry`/`fsEntry`.

### 2.3 Resources — terse factories (replace `beam.resource(Type, ...)`)
Every resource is a persistent GPU object, mutable via `.set(...)` returning `this`.
- `beam.verts(schema, state?)` → `Verts<V>` — one `GPUBuffer` per attribute (non-interleaved).
- `beam.index(state)` → `Index` — auto-selects uint16/uint32; `.count`/`.offset`.
- `beam.uniforms(schema, state?)` → `Uniforms<U>` — one std140-packed UBO; `.set(key,val)`
  / `.set(obj)`; dotted keys for nested structs.
- `beam.texture(src?, opts?)` → `Texture` and `beam.cube(faces?, opts?)` → `Texture`.
- `beam.sampler(opts?)` → `Sampler` — **immutable** (replace, don't mutate).

### 2.4–2.7 Bindings / BindGroup / Pass / Target / frame / loop
See the type surface (§ below) and the original design notes. `beam.target(opts)` is a
render pass with a sampleable color (and optional sampleable depth) texture; it `.draw`s
identically to `beam`. `beam.frame(cb)` encodes one frame; `beam.loop(cb)` runs a rAF
loop and returns `stop()`.

---

## 3. RESOLVED open questions (these are now part of the locked contract)

1. **Vertex buffers are non-interleaved, no instanced attributes.** One `GPUBuffer` per
   attribute (stride = attribute size, offset 0), matching old Beam's per-key
   `VertexBuffers`. None of the 24 gallery examples need interleaved or per-instance
   step-mode attributes (old Beam had no instancing; multi-object scenes use multiple
   draws). `instances` stays a draw count only.

2. **`mat3` packs as 3×`vec4` (48 bytes), `mat2` as 2×`vec2` (16 bytes), `mat4` as 64
   bytes.** The schema→offset computer pads `mat3` columns to 16. `.set` for `mat3`
   expands a 9-float input to the 12-float padded layout. A dev-mode assertion compares
   computed UBO size to schema and warns on std140 mismatch. (Examples should prefer
   passing `mat3` normal matrices as `mat4` where convenient to dodge the trap.)

3. **One UBO per `uniforms` resource. Multi-object scenes use one `uniforms` resource per
   object.** Because all draws in a `frame` submit together, `queue.writeBuffer` calls
   between draws all land before execution — sequential draws sharing one UBO would all
   read the *last* written value. So an N-object scene (multi-balls, material-balls,
   shadow grid) allocates N `uniforms` resources (or per-object model-matrix uniforms).
   This is WebGPU-correct and a key teaching point, documented in the guide. No
   storage-buffer / dynamic-offset path in the locked core surface (reachable via
   `beam.device`).

4. **Bind groups are cached by resource identity.** Auto-binding memoizes the
   `GPUBindGroup` per (pipeline-group, resource-set). Mutating a resource's contents via
   `.set` reuses the same buffer/bind group; allocating a *new* resource makes a new
   group. Combined with (3), per-object resources give correct per-object values.

5. **MSAA: `target.color` / the resolved texture is single-sample and sampleable.** With
   `samples: 4`, Beam allocates an internal multisample color texture and sets
   `resolveTarget` to the single-sample texture (swapchain view for the screen, the
   sampleable texture for a target). `samples: 1` is the fully-exercised default.

6. **Default loadOp is clear-to-black.** `beam.clear()` with no args clears to
   `[0, 0, 0, 1]` (depth 1). If a surface is drawn in a frame without a `clear()` call,
   its first pass that frame uses `loadOp: 'clear'` to `[0,0,0,1]`; subsequent draws to
   the same open pass `load` (accumulate). Explicit `clear(color)` overrides the color.

7. **HiDPI is opt-in.** `Beam.gpu(canvas, { hidpi: true })` (and `resize()`) multiply by
   `devicePixelRatio`; default off — sizing is the user's, as in the hello-world.

---

## 4. WGSL conventions

WGSL is hand-authored and never rewritten. Beam computes vertex + bind group layouts
from the schema; you follow ONE fixed convention.

- **One module, two entry points** `vs` / `fs` (override `vsEntry`/`fsEntry`).
- **Vertex attributes → `@location`, in schema key order.** Type map:
  `f32→f32/float32`, `vec2→vec2f/float32x2`, `vec3→vec3f/float32x3`,
  `vec4→vec4f/float32x4`, `i32→i32/sint32`, `u32→u32/uint32`. One buffer per attribute.
- **Uniforms → `@group(0) @binding(0)`, one UBO, std140.** Declare a WGSL `struct` whose
  fields mirror the schema order. Align: scalar 4, `vec2` 8, `vec3`/`vec4` 16, `mat2`
  16 (2×vec2 padded), `mat3` 48 (3×vec4), `mat4` 64. Put a scalar after a `vec3` to fill
  its trailing pad. Nested structs via dotted `.set('dirLight.direction', v)`. Uniform
  type map: `f32→f32`, `vec2→vec2f`, `vec3→vec3f`, `vec4→vec4f`, `mat2→mat2x2f`,
  `mat3→mat3x3f`, `mat4→mat4x4f`, `i32→i32`, `u32→u32`.
- **Textures then samplers → `@group(1)`.** Textures get `@binding(0..T-1)` (in
  `textures` key order), samplers `@binding(T..T+S-1)` (in `samplers` key order). Type
  map: `tex2d→texture_2d<f32>`, `texCube→texture_cube<f32>`, `texDepth→texture_depth_2d`;
  `sampler→sampler`, `samplerCompare→sampler_comparison`.
- **Examples:** one `.wgsl` per pipeline imported with `?raw`; `Uniforms` struct first,
  then bindings, then `@vertex`, then `@fragment`; comment each binding with its schema
  key.

---

## 5. Migration map (old beam-gl → beam-gpu)

| Old Beam (beam-gl)                                  | beam-gpu equivalent                                                                 |
|-----------------------------------------------------|-------------------------------------------------------------------------------------|
| `new Beam(canvas, config)`                          | `await Beam.gpu(canvas, config)` (alias `Beam.create`) — async                      |
| `beam.gl`                                           | `beam.device` (+ `beam.adapter`, `beam.ctx`, `beam.format`, `beam.canvas`)          |
| `beam.shader(template)`                             | `beam.pipeline(template)` → `Pipeline<V,U,T,S>`                                      |
| template `{ vs, fs }` (GLSL)                        | template `{ wgsl }` (one WGSL module); `vsEntry`/`fsEntry`                           |
| template `buffers` schema                           | template `vertex` schema (keys → `@location` order)                                 |
| template `uniforms` schema                          | template `uniforms` schema (one std140 UBO at `@group(0)@binding(0)`)               |
| template `textures` schema                          | template `textures` + `samplers` schemas (→ `@group(1)`)                            |
| template `mode` (Triangles/Lines)                   | template `primitive: 'tri'\|'tri-strip'\|'line'\|'point'`                           |
| template `defines`                                  | template `constants` (WGSL override constants)                                      |
| `beam.resource(VertexBuffers, state)`               | `beam.verts(schema, state)` → `Verts<V>`                                            |
| `beam.resource(IndexBuffer, { array, offset })`     | `beam.index({ array, offset?, count? })` → `Index`                                  |
| `beam.resource(Uniforms, state)`                    | `beam.uniforms(schema, state)` → `Uniforms<U>` (single UBO; dotted nested keys)    |
| `beam.resource(Textures, state)`                    | `beam.texture(src, opts)` / `beam.cube(faces, opts)` + `beam.sampler(opts)`         |
| `resource.set(key, val)`                            | `resource.set(key, val)` / `.set(obj)` — same mutable, chainable model              |
| `ResourceTypes` enum                                | removed (named factories; WebGPU has no such enum)                                  |
| `SchemaTypes.vec2/3/4,int,float,mat2/3/4`           | `'vec2'\|'vec3'\|'vec4'\|'i32'\|'f32'\|'mat2'\|'mat3'\|'mat4'` (+ `'u32'`)          |
| `SchemaTypes.tex2D` / `texCube`                     | `'tex2d'` + `beam.texture` / `'texCube'` + `beam.cube`                              |
| `beam.clear([r,g,b,a])`                             | `beam.clear([r,g,b,a], depth?)` — sets next screen pass loadOp; returns `this`      |
| `beam.draw(shader, vbuf, ibuf, uniforms, tex)`      | `beam.draw(pipe, { verts, index, uniforms, textures, samplers, instances? })`       |
| `beam.target(w, h, depth)`                          | `beam.target({ width, height, depth?, format?, samples? })` → `Target`             |
| `target.use(cb)`                                    | `target.clear().draw(pipe, bindings)` (same chain as `beam.draw`)                   |
| `target.texture`                                    | `target.color` (Texture) and `target.depth` (sampleable depth Texture)             |
| `textures.set('img', target.texture)`              | `bindings.textures = { img: target.color }` / `{ shadowMap: target.depth }`         |
| (manual rAF loop)                                   | `beam.loop((t, dt) => {...})` → `stop()`; or `beam.frame((t) => {...})`             |
| (implicit GL state machine)                         | implicit per-frame encoder inside `frame`/`loop`; `beam.pass()` power path          |

---

## 6. What we deliberately did NOT do
- No `layout: 'auto'`; no WGSL codegen; no positional `...resources`; no scattered
  per-uniform setters; no mutable samplers; no compute/indirect in the terse surface
  (reachable via `beam.device`); no `.end()/.submit()` on the happy path.
