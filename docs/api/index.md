---
title: API Reference
---

# API Reference

This is the complete public surface of **beam-gpu**, derived directly from the
locked type contract. Every signature below is the real one you import; every
snippet uses the genuine API. If you are learning the library, start with the
[Guide](/guide/introduction) — this page is the place you come back to once you
know the shape of things and just need the exact name, argument, or return type.

The mental model is small: a `Beam` device makes a `Pipeline` and some
**resources**, you hand one draw a keyed `Bindings` object, and `frame` wraps it
all in a command encoder. Five nouns, two verbs. Everything here hangs off that.

[[toc]]

## The `Beam` device

`Beam` is the device handle — adapter, GPU device, and configured canvas context
in one object. You create it asynchronously, then call everything else on it.

```ts
class Beam {
  static gpu(canvas: HTMLCanvasElement, config?: BeamConfig): Promise<Beam>
  static create(canvas: HTMLCanvasElement, config?: BeamConfig): Promise<Beam>

  readonly device: GPUDevice
  readonly adapter: GPUAdapter
  readonly ctx: GPUCanvasContext
  readonly format: GPUTextureFormat
  readonly canvas: HTMLCanvasElement
}
```

### `Beam.gpu` / `Beam.create`

```ts
static gpu(canvas: HTMLCanvasElement, config?: BeamConfig): Promise<Beam>
static create(canvas: HTMLCanvasElement, config?: BeamConfig): Promise<Beam>
```

Acquires a `GPUAdapter` and `GPUDevice`, reads
`navigator.gpu.getPreferredCanvasFormat()`, and configures the canvas context —
all in a single `await`. This is the one async step in Beam; everything after it
is synchronous. `create` is an exact alias of `gpu` for readers who prefer the
verb. Pass a [`BeamConfig`](#beamconfig) to pick a format, enable depth, opt into
HiDPI, request features/limits, or hand in your own `GPUDevice`.

```ts
const beam = await Beam.gpu(canvas)
```

### Device escape hatches

```ts
readonly device: GPUDevice
readonly adapter: GPUAdapter
readonly ctx: GPUCanvasContext
readonly format: GPUTextureFormat
readonly canvas: HTMLCanvasElement
```

Every Beam handle exposes the raw WebGPU object underneath it, and the device is
no exception. When you need something Beam does not wrap — a compute pass, a
storage buffer, a query set — reach through `beam.device` and write plain
WebGPU. Nothing is hidden from you.

```ts
const buf = beam.device.createBuffer({ size: 256, usage: GPUBufferUsage.STORAGE })
console.log(beam.format) // e.g. 'bgra8unorm'
```

### `pipeline`

```ts
pipeline<V, U, T, S>(template: PipelineTemplate<V, U, T, S>): Pipeline<V, U, T, S>
```

Compiles one [`PipelineTemplate`](#pipelinetemplate) — a WGSL module plus its
schemas — into a [`Pipeline`](#pipeline). The schemas drive three outputs at once:
TypeScript types, the vertex buffer layout (in `vertex` key order), and explicit
bind group layouts (uniforms at `@group(0)`, textures + samplers at `@group(1)`).
See the [WGSL conventions](/guide/wgsl-conventions) the module must follow.

```ts
const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})
```

### Resource factories

```ts
verts<V>(schema: V, state?: Partial<VertsState<V>>): Verts<V>
index(state: IndexState): Index
uniforms<U>(schema: U, state?: UniformState<U>): Uniforms<U>
texture(source?: TextureSource, opts?: TextureOpts): Texture
cube(faces?: CubeFaces, opts?: TextureOpts): Texture
sampler(opts?: SamplerOpts): Sampler
```

The terse factories that allocate persistent GPU objects. Each returns a mutable
handle whose `.set(...)` re-uploads and returns `this`, except `sampler`, which
is immutable. Pass `tri.schema.vertex` / `tri.schema.uniforms` to keep resources
in lockstep with the pipeline. See [resource handles](#resource-handles) below for
each type.

```ts
const verts = beam.verts(tri.schema.vertex, { position: [...], color: [...] })
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })
const tex = beam.texture(image, { srgb: true, mips: true })
const samp = beam.sampler({ wrap: 'repeat', min: 'linear', mag: 'linear' })
```

### `bind`

```ts
bind(layout: BindLayout, entries: BindEntries): BindGroup
```

The power-path counterpart to automatic binding. Given a [`BindLayout`](#bindlayout)
from `pipeline.group(i)` and an `entries` map of binding index → resource, it
builds a reusable named [`BindGroup`](#bindgroup) you can pass through
`bindings.groups`. Reach for this only when you want to bind a group once and
reuse it across many draws; the happy path never needs it.

```ts
const group = beam.bind(tri.group(1), { 0: tex, 1: samp })
beam.draw(tri, { verts, groups: [group] })
```

### `target`

```ts
target(opts: TargetOpts): Target
```

Allocates an offscreen [`Target`](#target) — a render-to-texture surface with a
sampleable color texture and optional sampleable depth. You draw into it exactly
like you draw to the screen, then feed `target.color` back into another draw as a
texture. This is how you build post-processing, shadow maps, and deferred passes.

```ts
const rtt = beam.target({ width: 512, height: 512, depth: true })
```

### `clear`

```ts
clear(color?: [number, number, number, number], depth?: number): this
```

Sets the load operation for the screen's next pass to *clear*, to the given color
(default `[0, 0, 0, 1]`) and depth (default `1`). Returns `this` so you can chain
straight into a draw. If you draw without ever calling `clear` in a frame, the
first pass clears to black anyway; subsequent draws to the same pass accumulate.

```ts
beam.clear([0.1, 0.1, 0.12, 1]).draw(tri, bindings)
```

### `draw`

```ts
draw<V, U, T, S>(
  pipeline: Pipeline<V, U, T, S>,
  bindings: Bindings<V, U, T, S>
): this
```

The everyday verb. Records one draw of `pipeline` with the keyed
[`Bindings`](#bindings) — which is generically typed against the pipeline's
schema, so a missing uniform or a misnamed texture is a compile error at the call
site. Bind groups are built and cached from the resources by identity. Returns
`this` to chain draws. Must run inside a [`frame`](#frame) or [`loop`](#loop).

```ts
beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

### `pass`

```ts
pass(opts?: PassOpts): Pass
```

The explicit render-pass escape hatch. Opens a [`Pass`](#pass) you drive by hand —
`clear`, `draw`, `viewport`, `scissor`, then `end` and `submit`. Use it when you
need viewport/scissor control, a custom `GPUCommandEncoder`, or several passes in
one frame. The happy path (`clear().draw()` inside `frame`) records into a default
screen pass for you, so most code never calls this.

```ts
const p = beam.pass({ clear: [0, 0, 0, 1] })
p.viewport(0, 0, 256, 256).draw(tri, bindings).end().submit()
```

### `frame`

```ts
frame(cb: (t: number) => void): void
```

Runs `cb` inside a single command encoder, then finishes and submits it — one
frame is one function. The callback receives a timestamp `t` (milliseconds). All
draws recorded inside `frame` submit together, which is why multi-object scenes
need one `uniforms` resource per object (writes between draws all land before
execution). Use `frame` for a static or event-driven render; use [`loop`](#loop)
for animation.

```ts
beam.frame((t) => {
  beam.clear([0, 0, 0, 1]).draw(tri, bindings)
})
```

### `loop`

```ts
loop(cb: (t: number, dt: number) => void): () => void
```

Starts a `requestAnimationFrame` loop, calling `cb` once per frame with the
absolute time `t` and the delta `dt` since the last frame (both in milliseconds).
Each tick is its own `frame`, so you `clear` and `draw` exactly as you would
otherwise. Returns a `stop()` function — call it to halt the loop.

```ts
const stop = beam.loop((t, dt) => {
  uniforms.set('angle', t * 0.001)
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
// later: stop()
```

### `resize`

```ts
resize(width?: number, height?: number): void
```

Reconfigures the canvas backing store and any size-dependent attachments. Called
with no arguments it matches the canvas's current CSS size; with explicit
dimensions it sets them. When the device was created with `{ hidpi: true }`, the
dimensions are multiplied by `devicePixelRatio`. Call this from a resize observer
or window `resize` handler.

```ts
new ResizeObserver(() => beam.resize()).observe(canvas)
```

### `destroy`

```ts
destroy(): void
```

Releases the device and the GPU objects Beam owns. Call it when tearing down a
view so the adapter and device are not leaked. Individual resources also have
their own `destroy()` if you want finer-grained control.

```ts
beam.destroy()
```

## Pipeline

### `PipelineTemplate`

```ts
interface PipelineTemplate<V, U, T, S> {
  wgsl: string
  vertex: V
  uniforms?: U
  textures?: T
  samplers?: S
  vsEntry?: string
  fsEntry?: string
  primitive?: Primitive
  cull?: Cull
  depth?: boolean | DepthOpts
  blend?: Blend
  targets?: ColorTarget[]
  samples?: 1 | 4
  constants?: Record<string, number | boolean>
  label?: string
}
```

The single declaration passed to `beam.pipeline`. `wgsl` is your hand-authored
module (never rewritten); `vertex`/`uniforms`/`textures`/`samplers` are the
schemas that generate layouts and types. `vsEntry`/`fsEntry` override the default
`vs`/`fs` entry points. The rest are fixed-function presets: `primitive`, `cull`,
`depth`, `blend`, per-`targets` color state, MSAA `samples`, WGSL override
`constants`, and a debug `label`.

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', normal: 'vec3', uv: 'vec2' },
  uniforms: { mvp: 'mat4', tint: 'vec4' },
  textures: { albedo: 'tex2d' },
  samplers: { samp: 'sampler' },
  depth: true,
  cull: 'back',
  blend: 'alpha'
})
```

### `Pipeline`

```ts
interface Pipeline<V, U, T, S> {
  readonly gpu: GPURenderPipeline
  readonly schema: { vertex: V; uniforms: U; textures: T; samplers: S }
  group(i: number): BindLayout
}
```

The compiled pipeline. `gpu` is the raw `GPURenderPipeline`. `schema` echoes the
template's schemas back to you — pass `schema.vertex` and `schema.uniforms`
straight into the resource factories so they line up by construction. `group(i)`
returns the [`BindLayout`](#bindlayout) for bind group `i` (0 = uniforms,
1 = textures + samplers) for the power-path `beam.bind`.

```ts
const verts = beam.verts(pipe.schema.vertex, state)
const layout = pipe.group(1)
```

## Resource handles

Every resource is a persistent, mutable GPU object. Mutators (`.set`) re-upload
and return `this` so they chain. Each exposes its raw GPU object(s) and a
`destroy()`. Allocating a *new* resource creates a new cached bind group;
mutating an existing one re-uses its buffer and group — this is how per-object
uniforms stay correct (see [Frame & Loop](/guide/frame-and-loop)).

### `Verts`

```ts
interface Verts<V> {
  readonly kind: 'verts'
  set<K extends keyof V>(key: K, value: number[] | Float32Array): this
  set(state: Partial<VertsState<V>>): this
  readonly count: number
  readonly buffers: Record<keyof V & string, GPUBuffer>
  destroy(): void
}
```

Vertex data, one `GPUBuffer` per attribute (non-interleaved). Create it with
`beam.verts(schema, state)`; update one attribute with `set(key, value)` or many
with `set(obj)`. `count` is the inferred vertex count (used when there is no
index buffer); `buffers` exposes the raw per-attribute buffers.

```ts
const verts = beam.verts(pipe.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
verts.set('color', newColors)
```

### `Index`

```ts
interface Index {
  readonly kind: 'index'
  set(state: IndexState): this
  readonly count: number
  readonly offset: number
  readonly format: GPUIndexFormat
  readonly buffer: GPUBuffer
  destroy(): void
}
```

An index buffer. `beam.index({ array })` auto-selects `uint16` or `uint32` from
the values; `count` and `offset` let a draw use a slice of the buffer. `format`
and `buffer` expose the chosen index format and raw `GPUBuffer`.

```ts
const index = beam.index({ array: [0, 1, 2, 2, 3, 0] })
index.set({ array: bigMesh, count: 9000, offset: 0 })
```

### `Uniforms`

```ts
interface Uniforms<U> {
  readonly kind: 'uniforms'
  set<K extends keyof U>(key: K, value: ValueOf<U[K]>): this
  set(key: string, value: number | number[] | Float32Array): this
  set(state: UniformState<U>): this
  readonly buffer: GPUBuffer
  destroy(): void
}
```

One std140-packed uniform buffer, bound at `@group(0) @binding(0)`. Set fields by
key, by dotted key for nested structs (`set('dirLight.direction', v)`), or in
bulk with an object. Because all draws in a frame submit together, a scene with
N independently-valued objects needs N `uniforms` resources — one shared UBO
would read only the last value written.

```ts
const u = beam.uniforms(pipe.schema.uniforms, { tint: [1, 1, 1, 1] })
u.set('mvp', mvpMatrix).set('tint', [1, 0, 0, 1])
```

### `Texture`

```ts
interface Texture {
  readonly kind: 'texture'
  set(source: TextureSource | CubeFaces, opts?: TextureOpts): this
  readonly gpu: GPUTexture
  readonly view: GPUTextureView
  readonly cube: boolean
  destroy(): void
}
```

A 2D or cube texture, created with `beam.texture(src, opts)` or
`beam.cube(faces, opts)`. `set` (re)uploads from a [`TextureSource`](#texturesource)
(or six faces for a cube) with optional [`TextureOpts`](#textureopts). `gpu` and
`view` are the raw texture and its default view; `cube` is `true` for cube maps.
A `Target`'s `color`/`depth` are `Texture`s, so RTT output binds like any image.

```ts
const tex = beam.texture(await loadImage('wood.png'), { srgb: true, mips: true })
const sky = beam.cube(faces, { srgb: true })
```

### `Sampler`

```ts
interface Sampler {
  readonly kind: 'sampler'
  readonly gpu: GPUSampler
}
```

A texture sampler — **immutable**. Configure wrap modes and filters at creation
with `beam.sampler(opts)`; to change them, make a new sampler rather than mutating
this one. `gpu` exposes the raw `GPUSampler`.

```ts
const samp = beam.sampler({ wrap: 'repeat', min: 'linear', mag: 'linear', mip: 'linear' })
```

## Bindings & draw data

### `Bindings`

```ts
interface Bindings<V, U, T, S> {
  verts: Verts<V>
  index?: Index
  uniforms?: Uniforms<U>
  textures?: { [K in keyof T]: Texture }
  samplers?: { [K in keyof S]: Sampler }
  instances?: number
  groups?: BindGroup[]
}
```

The keyed data for one draw — WebGPU binds by group + index, not by order, so a
draw's inputs are a single object generic over the pipeline schema. `verts` is
required; `index` switches to indexed drawing; `textures`/`samplers` are keyed by
schema name; `instances` is a draw count; `groups` injects pre-built
[`BindGroup`](#bindgroup)s for the power path. TypeScript checks every key against
the pipeline.

```ts
beam.draw(pipe, {
  verts, index, uniforms,
  textures: { albedo: tex },
  samplers: { samp },
  instances: 100
})
```

### Resource value shapes

```ts
type VertsState<V>   = { [K in keyof V]: number[] | Float32Array }
type UniformState<U> = { [K in keyof U]?: ValueOf<U[K]> }

interface IndexState {
  array: number[] | Uint16Array | Uint32Array
  count?: number
  offset?: number
}
```

The plain-data shapes the factories and `.set` accept. `VertsState` maps each
attribute key to an array; `UniformState` maps each uniform key to its
[`ValueOf`](#schema-vocabulary) value (all optional); `IndexState` carries the
index `array` plus optional `count`/`offset` for drawing a sub-range.

```ts
const state: VertsState<typeof pipe.schema.vertex> = { position: [...], color: [...] }
```

### `TextureSource`

```ts
type TextureSource =
  | ImageBitmap
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement
  | { data: BufferSource; width: number; height: number }

type CubeFaces = [TextureSource, TextureSource, TextureSource,
                  TextureSource, TextureSource, TextureSource]
```

What `beam.texture` / `Texture.set` accept as pixel data: any of the DOM image
sources, or a raw `{ data, width, height }` for procedural pixels. `CubeFaces` is
the six-source tuple for `beam.cube`, in +X, -X, +Y, -Y, +Z, -Z order.

```ts
beam.texture({ data: new Uint8Array([255, 0, 0, 255]), width: 1, height: 1 })
```

## Options & schema types

### Schema vocabulary

```ts
type Scalar  = 'f32' | 'i32' | 'u32'
type VecType = 'vec2' | 'vec3' | 'vec4'
type MatType = 'mat2' | 'mat3' | 'mat4'
type NumType = Scalar | VecType | MatType
type TexType = 'tex2d' | 'texCube' | 'texDepth'
type SampType = 'sampler' | 'samplerCompare'

type ValueOf<T> = T extends Scalar ? number : number[] | Float32Array

type VertexSchema  = Record<string, VecType | Scalar>
type UniformSchema = Record<string, NumType>
type TextureSchema = Record<string, TexType>
type SamplerSchema = Record<string, SampType>
```

The string-literal vocabulary that describes every schema. Vertex attributes are
scalars or vectors; uniforms add matrices; textures and samplers have their own
kinds. `ValueOf<T>` is the JS value a field takes — a `number` for scalars, an
array or `Float32Array` for vectors and matrices. These map to WGSL types per the
[WGSL conventions](/guide/wgsl-conventions).

```ts
const vertex: VertexSchema = { position: 'vec3', uv: 'vec2' }
const uniforms: UniformSchema = { mvp: 'mat4', time: 'f32' }
```

### `BeamConfig`

```ts
interface BeamConfig {
  format?: GPUTextureFormat
  alpha?: 'opaque' | 'premultiplied'
  depth?: boolean
  hidpi?: boolean
  power?: GPUPowerPreference
  features?: GPUFeatureName[]
  limits?: Record<string, number>
  device?: GPUDevice
}
```

Optional second argument to `Beam.gpu` / `Beam.create`. Override the canvas
`format` and `alpha` mode, request a depth attachment for the screen, opt into
`hidpi` scaling, hint adapter `power`, request `features` and `limits`, or pass an
existing `device` to share one across views. Every field has a sensible default,
so `Beam.gpu(canvas)` with no config is the common case.

```ts
const beam = await Beam.gpu(canvas, { depth: true, hidpi: true, power: 'high-performance' })
```

### Fixed-function presets

```ts
type Primitive = 'tri' | 'tri-strip' | 'line' | 'point'
type Cull      = 'none' | 'back' | 'front'
type Blend     = 'none' | 'alpha' | 'add'
```

The terse presets for the rasterizer. `Primitive` picks the topology, `Cull` the
face culling, `Blend` a common blend mode. They appear directly on
[`PipelineTemplate`](#pipelinetemplate) (and `Blend` also on
[`ColorTarget`](#depthopts-colortarget)).

```ts
beam.pipeline({ wgsl, vertex, primitive: 'tri-strip', cull: 'back', blend: 'add' })
```

### `DepthOpts` / `ColorTarget`

```ts
interface DepthOpts {
  test?: boolean
  write?: boolean
  compare?: GPUCompareFunction
  format?: GPUTextureFormat
}
interface ColorTarget {
  format?: GPUTextureFormat
  blend?: Blend
}
```

Fine-grained depth and color-target state for a pipeline. Pass `depth: true` for
defaults or a `DepthOpts` to control `test`/`write`/`compare`/`format`. `targets`
takes one `ColorTarget` per color attachment, each with its own `format` and
`blend` — needed for multiple render targets.

```ts
beam.pipeline({
  wgsl, vertex,
  depth: { test: true, write: false, compare: 'less-equal' },
  targets: [{ format: 'rgba16float', blend: 'alpha' }]
})
```

### `TextureOpts`

```ts
interface TextureOpts {
  format?: GPUTextureFormat
  srgb?: boolean
  flipY?: boolean
  mips?: boolean
  usage?: GPUTextureUsageFlags
  label?: string
}
```

Options for `beam.texture` / `beam.cube` / `Texture.set`. `srgb` selects an sRGB
view for color textures; `flipY` flips on upload; `mips` generates a mip chain;
`format` and `usage` override the defaults; `label` aids debugging.

```ts
const tex = beam.texture(image, { srgb: true, flipY: true, mips: true })
```

### `SamplerOpts`

```ts
interface SamplerOpts {
  wrap?: Wrap | [Wrap, Wrap] | [Wrap, Wrap, Wrap]
  mag?: Filter
  min?: Filter
  mip?: Filter
  compare?: GPUCompareFunction
}

type Wrap   = 'repeat' | 'mirror' | 'clamp'
type Filter = 'nearest' | 'linear'
```

Options for `beam.sampler`. `wrap` is one mode for all axes or a per-axis tuple
(U, V, W); `mag`/`min`/`mip` are the magnification, minification, and mipmap
filters; `compare` turns it into a comparison sampler for shadow mapping (pair
with a `samplerCompare` schema and a `texDepth` texture).

```ts
const shadowSamp = beam.sampler({ wrap: 'clamp', compare: 'less' })
```

## Targets & passes

### `TargetOpts`

```ts
interface TargetOpts {
  width: number
  height: number
  depth?: boolean
  format?: GPUTextureFormat
  samples?: 1 | 4
  label?: string
}
```

The required argument to `beam.target`. `width`/`height` size the offscreen
attachments; `depth: true` adds a sampleable depth texture (for shadow maps);
`format` overrides the color format; `samples: 4` enables MSAA (the resolved
`color` stays single-sample and sampleable); `label` aids debugging.

```ts
const rtt = beam.target({ width: 1024, height: 1024, depth: true, samples: 4 })
```

### `Target`

```ts
interface Target {
  readonly width: number
  readonly height: number
  readonly color: Texture
  readonly depth?: Texture
  clear(color?: [number, number, number, number], depth?: number): this
  draw<V, U, T, S>(
    pipeline: Pipeline<V, U, T, S>,
    bindings: Bindings<V, U, T, S>
  ): this
  resize(width: number, height: number): void
  destroy(): void
}
```

An offscreen render target. It `clear`s and `draw`s with the exact same chain as
`beam` itself, so rendering into a texture is no different from rendering to the
screen. Afterward, `color` (and `depth`, if requested) are `Texture`s you bind
into a later draw. `resize` reallocates the attachments; `destroy` frees them.

```ts
beam.frame(() => {
  rtt.clear([0, 0, 0, 1]).draw(scene, sceneBindings)
  beam.clear([0, 0, 0, 1]).draw(post, { verts: quad, textures: { src: rtt.color }, samplers: { samp } })
})
```

### `PassOpts`

```ts
interface PassOpts {
  target?: Target
  clear?: [number, number, number, number] | null
  clearDepth?: number | null
  encoder?: GPUCommandEncoder
}
```

The optional argument to `beam.pass`. `target` aims the pass at an offscreen
[`Target`](#target) instead of the screen; `clear`/`clearDepth` set the load ops
(pass `null` to `load` rather than clear); `encoder` lets you record into a
`GPUCommandEncoder` you own, so a pass can share one frame's command buffer with
other work.

```ts
const p = beam.pass({ target: rtt, clear: [0, 0, 0, 1], clearDepth: 1 })
```

### `Pass`

```ts
interface Pass {
  readonly gpu: GPURenderPassEncoder
  readonly encoder: GPUCommandEncoder
  clear(color?: [number, number, number, number], depth?: number): this
  draw(pipeline: Pipeline, bindings: Bindings): this
  viewport(x: number, y: number, w: number, h: number): this
  scissor(x: number, y: number, w: number, h: number): this
  end(): this
  submit(): void
}
```

The explicit render pass from `beam.pass` — the power path that `frame` hides on
your behalf. `clear` and `draw` work as usual; `viewport` and `scissor` restrict
rendering to a rectangle (split-screen, picking, tiled rendering); `end` closes
the pass and `submit` finishes the encoder and submits it. `gpu` and `encoder`
expose the raw WebGPU pass encoder and command encoder.

```ts
const p = beam.pass({ clear: [0, 0, 0, 1] })
p.viewport(0, 0, 200, 400).draw(left, leftBindings)
p.viewport(200, 0, 200, 400).draw(right, rightBindings)
p.end().submit()
```

## Bind groups (power path)

You rarely touch these directly — `draw` builds and caches bind groups from the
keyed `bindings`. Reach for them only to bind a group once and reuse it across
many draws.

### `BindLayout`

```ts
interface BindLayout {
  readonly gpu: GPUBindGroupLayout
  readonly index: number
}
```

A typed handle to one of a pipeline's bind group layouts, returned by
`pipeline.group(i)`. `gpu` is the raw `GPUBindGroupLayout`; `index` is the group
number (0 for uniforms, 1 for textures + samplers). Because Beam builds layouts
from the schema (never `layout: 'auto'`), groups are reusable across pipelines
that share a schema. Feed it to `beam.bind`.

```ts
const layout = pipe.group(1)
```

### `BindResource` / `BindEntries`

```ts
type BindResource =
  | Uniforms | Texture | Sampler
  | GPUBuffer | GPUTextureView | GPUSampler
type BindEntries = Record<number, BindResource>
```

The value map you pass to `beam.bind`: binding index → resource. A `BindResource`
may be a Beam handle (`Uniforms`, `Texture`, `Sampler`) or a raw WebGPU object
(`GPUBuffer`, `GPUTextureView`, `GPUSampler`), so the power path mixes Beam
resources with hand-built ones freely.

```ts
const entries: BindEntries = { 0: tex, 1: samp }
```

### `BindGroup`

```ts
interface BindGroup {
  readonly gpu: GPUBindGroup
  readonly index: number
}
```

A reusable, named bind group built by `beam.bind(layout, entries)`. `gpu` is the
raw `GPUBindGroup`; `index` is the group number it occupies. Pass it through
`bindings.groups` to a draw, and it is bound at that index instead of an
auto-built group.

```ts
const group = beam.bind(pipe.group(1), { 0: tex, 1: samp })
beam.draw(pipe, { verts, uniforms, groups: [group] })
```
