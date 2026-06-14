---
title: 管线
---

# 管线（Pipeline）

管线是某一种绘制的"配方"。`beam.pipeline(template)` 接受一份声明——你手写的
WGSL 加上几个 schema——并返回一个 `Pipeline<V, U, T, S>`，它同时掌握三件事：

- 每次绘制所需数据的 **TypeScript 类型**，
- **顶点缓冲布局**（stride、offset、format），以及
- **绑定组布局**（哪些 uniform、纹理和采样器分别位于何处）。

它是旧版 Beam 中 `beam.shader(template)` 的继任者。最大的转变在于：在 WebGPU 中
你手写一个 WGSL 模块，而 Beam 绝不会改写它。Beam 只会根据你声明的 schema，在你的
着色器 *周围* 推导布局。

## 最小的管线

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

就这么简单。`tri` 现在是一个具备完整类型的 `Pipeline`。其中 `vertex`、`uniforms`、
`textures` 和 `samplers` 这几个键就是 **schema**；模板中其余的一切都是固定功能
预设，并带有合理的默认值。

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

## schema 驱动一切

schema 由四个可选的记录组成（只有 `vertex` 是必需的）。每个记录将字段名映射到
[schema 词汇表](/zh/guide/wgsl-conventions)中的某个类型字符串。键的 **顺序** 很重要：
它决定了 `@location` 和 `@binding` 的索引。

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex:   { position: 'vec3', normal: 'vec3', uv: 'vec2' },
  uniforms: { mvp: 'mat4', tint: 'vec4' },
  textures: { albedo: 'tex2d' },
  samplers: { samp: 'sampler' }
})
```

### `vertex` → 顶点布局 + `@location`

每个顶点字段对应一个非交错（non-interleaved）的顶点缓冲。字段在记录中的位置就成为
它的 `@location`：

| schema 键  | 类型    | `@location` | WGSL 类型 | format     |
|------------|---------|-------------|-----------|------------|
| `position` | `vec3`  | `0`         | `vec3f`   | `float32x3`|
| `normal`   | `vec3`  | `1`         | `vec3f`   | `float32x3`|
| `uv`       | `vec2`  | `2`         | `vec2f`   | `float32x2`|

因此你的 `@vertex` 入口要严格按照这个顺序读取属性：

```wgsl
@vertex
fn vs(
  @location(0) position : vec3f,  // vertex.position
  @location(1) normal   : vec3f,  // vertex.normal
  @location(2) uv       : vec2f,  // vertex.uv
) -> VsOut { /* ... */ }
```

顶点 schema 只接受标量和向量类型——不支持矩阵。每个属性对应一个缓冲，不交错，也没有
逐实例属性；`instances` 仅仅是一个绘制计数。

### `uniforms` → 位于 `@group(0) @binding(0)` 的单个 UBO

所有 uniform 字段会打包进 **一个** std140 uniform 缓冲，按 schema 键的顺序声明为
一个 WGSL `struct`：

```wgsl
struct Uniforms {
  mvp  : mat4x4f,  // uniforms.mvp
  tint : vec4f,    // uniforms.tint
};
@group(0) @binding(0) var<uniform> u : Uniforms;
```

矩阵和 `vec3` 带有 std140 对齐陷阱（一个 `mat3` 是三个被填充的 `vec4`，共 48 字节；
一个 `vec3` 后面想要塞进一个标量）。[WGSL 约定](/zh/guide/wgsl-conventions)页面列出了
完整的对齐表。

### `textures` 然后 `samplers` → `@group(1)`

纹理按 `textures` 键的顺序获得 `@binding(0..T-1)`；采样器紧随其后，按 `samplers`
键的顺序从 `@binding(T..)` 开始——它们全都位于 `@group(1)`：

```wgsl
@group(1) @binding(0) var albedo : texture_2d<f32>;  // textures.albedo
@group(1) @binding(1) var samp   : sampler;          // samplers.samp
```

由于 Beam 是根据你的 schema 构建这些布局的（绝不会使用 `layout: 'auto'`），因此
绑定组可以在任何共享相同 schema 的管线之间复用。

## schema 喂养你的资源

schema 不仅用于 WGSL——你可以把它直接传给资源工厂函数，让你的数据相对管线得到类型
校验：

```ts
const verts = beam.verts(pipe.schema.vertex, {
  position: positions,
  normal: normals,
  uv: uvs
})
const uniforms = beam.uniforms(pipe.schema.uniforms, { tint: [1, 1, 1, 1] })
```

这样，你交给 `draw` 的 `bindings` 对象就会相对管线得到完整的类型检查：

```ts
beam.frame(() => {
  beam.clear().draw(pipe, { verts, index, uniforms, textures: { albedo }, samplers: { samp } })
})
```

数据侧的内容请参见 [资源](/zh/guide/resources) 和
[绑定与绘制](/zh/guide/bindings-and-draw)。

## 固定功能预设

schema 之外的一切都用来配置固定功能阶段。它们全都是可选的，并默认采用常见情形
（一个不透明、经过深度测试、绘制到画布格式的三角形列表）：

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3' },

  primitive: 'tri',         // 'tri' | 'tri-strip' | 'line' | 'point'
  cull: 'back',             // 'none' | 'back' | 'front'
  depth: true,              // boolean | { test, write, compare, format }
  blend: 'alpha',           // 'none' | 'alpha' | 'add'
  samples: 4,               // 1 | 4 — MSAA
  vsEntry: 'vs',            // 覆盖 @vertex 入口名称
  fsEntry: 'fs',            // 覆盖 @fragment 入口名称
  constants: { LIGHTS: 3 }, // WGSL override 常量
  label: 'lit'
})
```

| 预设         | 默认值               | 说明                                                    |
|--------------|----------------------|---------------------------------------------------------|
| `primitive`  | `'tri'`              | 三角形列表、三角形条带、线段或点列表。                  |
| `cull`       | `'none'`             | 背面/正面剔除。                                          |
| `depth`      | `false`              | `true` 启用深度附件；或传入 `DepthOpts`。               |
| `blend`      | `'none'`             | `'alpha'` 用于透明，`'add'` 用于加法混合。              |
| `targets`    | 一个画布格式的目标   | 用 `ColorTarget[]` 实现 MRT 或逐目标混合。              |
| `samples`    | `1`                  | `4` 启用 MSAA（由 Beam 管理解析过程）。                 |
| `constants`  | 无                   | WGSL `override` 常量，取代 GLSL 的 `defines`。          |
| `vsEntry` / `fsEntry` | `'vs'` / `'fs'` | 重命名 Beam 查找的入口点。                          |

### `depth` 详解

`depth: true` 是常见的"使用 `less` 进行测试并写入"的简写。对于阴影 pass 或只读深度，
可以传入对象形式：

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3' },
  depth: { test: true, write: false, compare: 'less-equal' }
})
```

### `blend` 和 `targets`

`blend` 是针对单个默认颜色目标的快捷方式。对于多个渲染目标，或者要为每个附件混搭
不同的格式和混合模式，则需要明确写出 `targets`：

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

## WGSL 由你手写

Beam 绝不会生成或改写你的着色器。你编写一个带有 `@vertex` 和 `@fragment` 入口的
WGSL 模块（默认名为 `vs` / `fs`），并遵循 **一套固定约定**，使你的 `@location` 和
`@group`/`@binding` 索引与 Beam 推导出的 schema 对齐。用 `?raw` 导入它：

```ts
import wgsl from './lit.wgsl?raw'
const pipe = beam.pipeline({ wgsl, vertex: { position: 'vec3' } })
```

完整的约定——类型映射、std140 对齐、绑定顺序以及推荐的文件结构——都在
[WGSL 约定](/zh/guide/wgsl-conventions) 中。在编写你的第一个着色器之前请先阅读它；
正是这份契约让你手写的 WGSL 与 schema 保持一致。
