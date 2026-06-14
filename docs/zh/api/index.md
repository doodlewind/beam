---
title: API 参考
---

# API 参考

这里是 **beam-gpu** 的完整公开接口，直接源自锁定的类型契约。下面的每一个签名都是你真正会导入使用的那个；每一段代码片段用的都是真实的 API。如果你刚开始学习这个库，请从[指南](/zh/guide/introduction)开始——而本页则是你在熟悉了整体结构之后，需要查阅确切名称、参数或返回类型时回来翻看的地方。

它的心智模型很小：一个 `Beam` 设备创建出一个 `Pipeline` 和若干**资源**，你把一个带键的 `Bindings` 对象交给某次绘制，然后 `frame` 把这一切包进一个命令编码器里。五个名词，两个动词。这里的所有内容都挂在这套结构之上。

[[toc]]

## `Beam` 设备

`Beam` 就是设备句柄——把适配器、GPU 设备和配置好的画布上下文统统装进一个对象里。你以异步方式创建它，之后所有其他操作都在它上面调用。

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

获取一个 `GPUAdapter` 和一个 `GPUDevice`，读取
`navigator.gpu.getPreferredCanvasFormat()`，并配置画布上下文——这一切都在一次
`await` 中完成。这是 Beam 中唯一的异步步骤；之后的一切都是同步的。对于偏爱用动词命名的读者，`create` 是 `gpu` 的精确别名。传入一个 [`BeamConfig`](#beamconfig) 即可选择格式、启用深度、开启 HiDPI、请求特性/限制，或交进你自己的 `GPUDevice`。

```ts
const beam = await Beam.gpu(canvas)
```

### 设备逃生通道

```ts
readonly device: GPUDevice
readonly adapter: GPUAdapter
readonly ctx: GPUCanvasContext
readonly format: GPUTextureFormat
readonly canvas: HTMLCanvasElement
```

每一个 Beam 句柄都会暴露其底层的原始 WebGPU 对象，设备也不例外。当你需要某些 Beam 没有封装的东西时——一个计算 pass、一个存储缓冲区、一个查询集——直接通过 `beam.device` 取用，写裸 WebGPU 即可。对你没有任何隐藏。

```ts
const buf = beam.device.createBuffer({ size: 256, usage: GPUBufferUsage.STORAGE })
console.log(beam.format) // 例如 'bgra8unorm'
```

### `pipeline`

```ts
pipeline<V, U, T, S>(template: PipelineTemplate<V, U, T, S>): Pipeline<V, U, T, S>
```

把一个 [`PipelineTemplate`](#pipelinetemplate)——一个 WGSL 模块加上它的若干 schema——编译成一个 [`Pipeline`](#pipeline)。这些 schema 会同时驱动三项输出：TypeScript 类型、顶点缓冲区布局（按 `vertex` 键的顺序），以及显式的绑定组布局（uniform 位于 `@group(0)`，纹理 + 采样器位于 `@group(1)`）。模块必须遵循的约定见 [WGSL 约定](/zh/guide/wgsl-conventions)。

```ts
const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})
```

### 资源工厂

```ts
verts<V>(schema: V, state?: Partial<VertsState<V>>): Verts<V>
index(state: IndexState): Index
uniforms<U>(schema: U, state?: UniformState<U>): Uniforms<U>
texture(source?: TextureSource, opts?: TextureOpts): Texture
cube(faces?: CubeFaces, opts?: TextureOpts): Texture
sampler(opts?: SamplerOpts): Sampler
```

用于分配持久 GPU 对象的简洁工厂。每个工厂都返回一个可变句柄，其 `.set(...)` 会重新上传并返回 `this`，唯独 `sampler` 例外——它是不可变的。把 `tri.schema.vertex` / `tri.schema.uniforms` 传进去，能让资源与 pipeline 保持步调一致。各类型的说明见下方的[资源句柄](#资源句柄)。

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

自动绑定的高阶（power-path）对应物。给定一个来自 `pipeline.group(i)` 的 [`BindLayout`](#bindlayout)，以及一个「绑定索引 → 资源」的 `entries` 映射，它会构建出一个可复用的具名 [`BindGroup`](#bindgroup)，你可以通过 `bindings.groups` 传入。只有当你想把一个组绑定一次、并在多次绘制间复用它时才需要用到它；顺畅路径（happy path）永远用不到。

```ts
const group = beam.bind(tri.group(1), { 0: tex, 1: samp })
beam.draw(tri, { verts, groups: [group] })
```

### `target`

```ts
target(opts: TargetOpts): Target
```

分配一个离屏的 [`Target`](#target)——一个渲染到纹理（render-to-texture）的表面，带有一个可采样的颜色纹理和一个可选的可采样深度。你向它绘制的方式与向屏幕绘制完全一样，然后把 `target.color` 当作纹理再喂给另一次绘制。后处理、阴影贴图和延迟渲染 pass 都是这么搭建出来的。

```ts
const rtt = beam.target({ width: 512, height: 512, depth: true })
```

### `clear`

```ts
clear(color?: [number, number, number, number], depth?: number): this
```

把屏幕下一个 pass 的加载操作（load operation）设为*清屏*，清成给定的颜色（默认 `[0, 0, 0, 1]`）和深度（默认 `1`）。返回 `this`，于是你可以直接链式接上一次绘制。如果你在一帧里从未调用过 `clear` 就直接绘制，第一个 pass 仍然会清成黑色；同一个 pass 上的后续绘制则会累加上去。

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

日常使用的动词。用带键的 [`Bindings`](#bindings) 记录 `pipeline` 的一次绘制——`Bindings` 是针对 pipeline 的 schema 做了泛型约束的，所以缺失某个 uniform 或写错某个纹理名，会在调用点处变成一个编译期错误。绑定组会按身份（identity）从资源构建并缓存。返回 `this` 以便链式绘制。必须在 [`frame`](#frame) 或 [`loop`](#loop) 内部运行。

```ts
beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

### `pass`

```ts
pass(opts?: PassOpts): Pass
```

显式的渲染 pass 逃生通道。打开一个由你手动驱动的 [`Pass`](#pass)——`clear`、`draw`、`viewport`、`scissor`，然后 `end` 再 `submit`。当你需要视口/裁剪控制、一个自定义的 `GPUCommandEncoder`，或在一帧里安排多个 pass 时使用它。顺畅路径（在 `frame` 内 `clear().draw()`）会替你把绘制记录进一个默认的屏幕 pass，所以大多数代码从来不会调用它。

```ts
const p = beam.pass({ clear: [0, 0, 0, 1] })
p.viewport(0, 0, 256, 256).draw(tri, bindings).end().submit()
```

### `frame`

```ts
frame(cb: (t: number) => void): void
```

在单个命令编码器内运行 `cb`，然后结束并提交它——一帧就是一个函数。回调会收到一个时间戳 `t`（毫秒）。在 `frame` 内部记录的所有绘制会一起提交，这也正是为什么多对象场景需要每个对象配一个 `uniforms` 资源（绘制之间的写入都会在执行前落定）。静态或事件驱动的渲染用 `frame`；动画则用 [`loop`](#loop)。

```ts
beam.frame((t) => {
  beam.clear([0, 0, 0, 1]).draw(tri, bindings)
})
```

### `loop`

```ts
loop(cb: (t: number, dt: number) => void): () => void
```

启动一个 `requestAnimationFrame` 循环，每帧调用一次 `cb`，传入绝对时间 `t` 和自上一帧以来的增量 `dt`（均为毫秒）。每一次 tick 本身都是一个 `frame`，所以你照常 `clear` 和 `draw` 即可。返回一个 `stop()` 函数——调用它即可停止循环。

```ts
const stop = beam.loop((t, dt) => {
  uniforms.set('angle', t * 0.001)
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
// 之后：stop()
```

### `resize`

```ts
resize(width?: number, height?: number): void
```

重新配置画布的后备存储（backing store）以及任何依赖尺寸的附件。不带参数调用时，它会匹配画布当前的 CSS 尺寸；带显式尺寸时则设为这些尺寸。当设备是以 `{ hidpi: true }` 创建的，尺寸会乘以 `devicePixelRatio`。请在 resize observer 或窗口 `resize` 处理器中调用它。

```ts
new ResizeObserver(() => beam.resize()).observe(canvas)
```

### `destroy`

```ts
destroy(): void
```

释放设备以及 Beam 所拥有的 GPU 对象。在拆除一个视图时调用它，这样适配器和设备就不会泄漏。如果你想要更细粒度的控制，各个单独的资源也有自己的 `destroy()`。

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

传给 `beam.pipeline` 的那个单一声明。`wgsl` 是你亲手编写的模块（永远不会被改写）；`vertex`/`uniforms`/`textures`/`samplers` 是用来生成布局和类型的 schema。`vsEntry`/`fsEntry` 覆盖默认的 `vs`/`fs` 入口点。其余的都是固定功能（fixed-function）预设：`primitive`、`cull`、`depth`、`blend`、逐 `targets` 的颜色状态、MSAA `samples`、WGSL 覆盖 `constants`，以及一个调试用的 `label`。

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

编译后的 pipeline。`gpu` 是原始的 `GPURenderPipeline`。`schema` 把模板的各个 schema 原样回传给你——把 `schema.vertex` 和 `schema.uniforms` 直接传进资源工厂，它们便会在构造时自然对齐。`group(i)` 返回绑定组 `i` 的 [`BindLayout`](#bindlayout)（0 = uniform，1 = 纹理 + 采样器），供高阶路径的 `beam.bind` 使用。

```ts
const verts = beam.verts(pipe.schema.vertex, state)
const layout = pipe.group(1)
```

## 资源句柄

每一个资源都是一个持久的、可变的 GPU 对象。变更器（`.set`）会重新上传并返回 `this`，因此可以链式调用。每个都暴露其原始 GPU 对象和一个 `destroy()`。分配一个*新*资源会创建一个新的缓存绑定组；变更一个已有资源则会复用它的缓冲区和组——per-object（逐对象）的 uniform 正是靠这一点才能保持正确（参见 [Frame 与 Loop](/zh/guide/frame-and-loop)）。

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

顶点数据，每个属性一个 `GPUBuffer`（非交错存储）。用 `beam.verts(schema, state)` 创建它；用 `set(key, value)` 更新单个属性，或用 `set(obj)` 更新多个。`count` 是推断出的顶点数量（在没有索引缓冲区时使用）；`buffers` 暴露各属性对应的原始缓冲区。

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

一个索引缓冲区。`beam.index({ array })` 会根据数值自动选择 `uint16` 或 `uint32`；`count` 和 `offset` 让一次绘制能使用缓冲区的某个切片。`format` 和 `buffer` 暴露所选的索引格式和原始 `GPUBuffer`。

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

一个按 std140 打包的 uniform 缓冲区，绑定在 `@group(0) @binding(0)`。可以按键设置字段、按点分隔的键设置嵌套结构体（`set('dirLight.direction', v)`），或用一个对象批量设置。因为一帧里的所有绘制会一起提交，一个含有 N 个各自独立取值对象的场景需要 N 个 `uniforms` 资源——单个共享的 UBO 只会读到最后写入的那个值。

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

一个 2D 或立方体（cube）纹理，用 `beam.texture(src, opts)` 或
`beam.cube(faces, opts)` 创建。`set` 从一个 [`TextureSource`](#texturesource)（或立方体的六个面）（重新）上传，可带可选的 [`TextureOpts`](#textureopts)。`gpu` 和
`view` 是原始纹理及其默认视图；`cube` 对立方体贴图为 `true`。一个 `Target` 的 `color`/`depth` 都是 `Texture`，所以 RTT 输出可以像任何图像一样绑定。

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

一个纹理采样器——**不可变**。在用 `beam.sampler(opts)` 创建时配置环绕模式和过滤器；要改变它们，请新建一个采样器，而不是变更这一个。`gpu` 暴露原始的 `GPUSampler`。

```ts
const samp = beam.sampler({ wrap: 'repeat', min: 'linear', mag: 'linear', mip: 'linear' })
```

## Bindings 与绘制数据

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

一次绘制所需的带键数据——WebGPU 是按「组 + 索引」绑定的，而非按顺序，所以一次绘制的输入就是一个针对 pipeline schema 做了泛型约束的单一对象。`verts` 是必需的；`index` 切换到索引绘制；`textures`/`samplers` 按 schema 名称作键；`instances` 是绘制（实例）数量；`groups` 为高阶路径注入预先构建好的 [`BindGroup`](#bindgroup)。TypeScript 会对照 pipeline 检查每一个键。

```ts
beam.draw(pipe, {
  verts, index, uniforms,
  textures: { albedo: tex },
  samplers: { samp },
  instances: 100
})
```

### 资源的值形状

```ts
type VertsState<V>   = { [K in keyof V]: number[] | Float32Array }
type UniformState<U> = { [K in keyof U]?: ValueOf<U[K]> }

interface IndexState {
  array: number[] | Uint16Array | Uint32Array
  count?: number
  offset?: number
}
```

工厂和 `.set` 所接受的纯数据形状。`VertsState` 把每个属性键映射到一个数组；`UniformState` 把每个 uniform 键映射到它的 [`ValueOf`](#schema-词汇表)值（全部可选）；`IndexState` 携带索引 `array` 以及用于绘制子范围的可选 `count`/`offset`。

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

`beam.texture` / `Texture.set` 所接受的像素数据：任意 DOM 图像源之一，或用于程序化像素的原始 `{ data, width, height }`。`CubeFaces` 是供 `beam.cube` 使用的六源元组，顺序为 +X、-X、+Y、-Y、+Z、-Z。

```ts
beam.texture({ data: new Uint8Array([255, 0, 0, 255]), width: 1, height: 1 })
```

## 选项与 schema 类型

### Schema 词汇表

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

描述每一个 schema 的字符串字面量词汇表。顶点属性是标量或向量；uniform 还可以是矩阵；纹理和采样器各有自己的种类。`ValueOf<T>` 是某个字段所取的 JS 值——标量取 `number`，向量和矩阵取数组或 `Float32Array`。它们按 [WGSL 约定](/zh/guide/wgsl-conventions)映射到 WGSL 类型。

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

`Beam.gpu` / `Beam.create` 的可选第二参数。覆盖画布的 `format` 和 `alpha` 模式、为屏幕请求一个深度附件、开启 `hidpi` 缩放、提示适配器的 `power`、请求 `features` 和 `limits`，或传入一个已有的 `device` 以在多个视图间共享。每个字段都有合理的默认值，所以不带任何配置的 `Beam.gpu(canvas)` 才是常见情形。

```ts
const beam = await Beam.gpu(canvas, { depth: true, hidpi: true, power: 'high-performance' })
```

### 固定功能预设

```ts
type Primitive = 'tri' | 'tri-strip' | 'line' | 'point'
type Cull      = 'none' | 'back' | 'front'
type Blend     = 'none' | 'alpha' | 'add'
```

供光栅器使用的简洁预设。`Primitive` 选择拓扑，`Cull` 选择面剔除，`Blend` 选择一种常见的混合模式。它们直接出现在 [`PipelineTemplate`](#pipelinetemplate) 上（`Blend` 也出现在 [`ColorTarget`](#depthopts-colortarget) 上）。

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

pipeline 的细粒度深度与颜色目标（color-target）状态。传 `depth: true` 取默认值，或传一个 `DepthOpts` 来控制 `test`/`write`/`compare`/`format`。`targets` 为每个颜色附件接受一个 `ColorTarget`，各自带有自己的 `format` 和 `blend`——多渲染目标（MRT）时需要用到。

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

`beam.texture` / `beam.cube` / `Texture.set` 的选项。`srgb` 为颜色纹理选取一个 sRGB 视图；`flipY` 在上传时翻转；`mips` 生成一条 mip 链；`format` 和 `usage` 覆盖默认值；`label` 有助于调试。

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

`beam.sampler` 的选项。`wrap` 是适用于所有轴的单一模式，或一个逐轴的元组（U、V、W）；`mag`/`min`/`mip` 分别是放大、缩小和 mipmap 过滤器；`compare` 把它变成一个用于阴影贴图的比较采样器（配合一个 `samplerCompare` schema 和一个 `texDepth` 纹理使用）。

```ts
const shadowSamp = beam.sampler({ wrap: 'clamp', compare: 'less' })
```

## Target 与 Pass

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

`beam.target` 的必需参数。`width`/`height` 设定离屏附件的尺寸；`depth: true` 添加一个可采样的深度纹理（用于阴影贴图）；`format` 覆盖颜色格式；`samples: 4` 启用 MSAA（解析后的 `color` 仍是单采样且可采样的）；`label` 有助于调试。

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

一个离屏渲染目标。它用与 `beam` 自身完全相同的链式调用来 `clear` 和 `draw`，所以渲染进一个纹理和渲染到屏幕没有任何区别。之后，`color`（以及 `depth`，如果请求了的话）都是 `Texture`，你可以把它们绑定进后续的绘制。`resize` 重新分配附件；`destroy` 释放它们。

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

`beam.pass` 的可选参数。`target` 把这个 pass 瞄准一个离屏的 [`Target`](#target) 而非屏幕；`clear`/`clearDepth` 设置加载操作（传 `null` 表示 `load` 而非清屏）；`encoder` 让你记录进一个你自己拥有的 `GPUCommandEncoder`，这样一个 pass 就能与其他工作共享同一帧的命令缓冲区。

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

来自 `beam.pass` 的显式渲染 pass——也就是 `frame` 替你隐藏起来的那条高阶路径。`clear` 和 `draw` 照常工作；`viewport` 和 `scissor` 把渲染限制在一个矩形内（分屏、拾取、分块渲染）；`end` 关闭这个 pass，`submit` 结束编码器并提交它。`gpu` 和 `encoder` 暴露原始的 WebGPU pass 编码器和命令编码器。

```ts
const p = beam.pass({ clear: [0, 0, 0, 1] })
p.viewport(0, 0, 200, 400).draw(left, leftBindings)
p.viewport(200, 0, 200, 400).draw(right, rightBindings)
p.end().submit()
```

## 绑定组（高阶路径）

你很少会直接接触这些——`draw` 会从带键的 `bindings` 构建并缓存绑定组。只有当你想把一个组绑定一次、并在多次绘制间复用它时，才需要用到它们。

### `BindLayout`

```ts
interface BindLayout {
  readonly gpu: GPUBindGroupLayout
  readonly index: number
}
```

指向某个 pipeline 的某个绑定组布局的类型化句柄，由 `pipeline.group(i)` 返回。`gpu` 是原始的 `GPUBindGroupLayout`；`index` 是组编号（0 表示 uniform，1 表示纹理 + 采样器）。因为 Beam 是从 schema 构建布局的（从不使用 `layout: 'auto'`），所以共享同一 schema 的多个 pipeline 之间，组是可以复用的。把它喂给 `beam.bind`。

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

你传给 `beam.bind` 的那个值映射：绑定索引 → 资源。一个 `BindResource` 既可以是一个 Beam 句柄（`Uniforms`、`Texture`、`Sampler`），也可以是一个原始 WebGPU 对象（`GPUBuffer`、`GPUTextureView`、`GPUSampler`），所以高阶路径可以自由地把 Beam 资源与手工构建的对象混用。

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

由 `beam.bind(layout, entries)` 构建的、可复用的具名绑定组。`gpu` 是原始的 `GPUBindGroup`；`index` 是它所占据的组编号。通过 `bindings.groups` 把它传给一次绘制，它就会被绑定在那个索引上，取代自动构建的组。

```ts
const group = beam.bind(pipe.group(1), { 0: tex, 1: samp })
beam.draw(pipe, { verts, uniforms, groups: [group] })
```
