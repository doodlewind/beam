---
title: 资源
---

# 资源

管线（pipeline）描述的是*如何*绘制；资源则是你用来绘制的*数据*：顶点、
索引、uniform、纹理、采样器。在 beam-gpu 中，每个资源都是围绕真实的
`GPUBuffer`/`GPUTexture`/`GPUSampler` 的一个轻量、持久的句柄——你只创建一次，
长期持有它，并通过 `.set(...)` 以极低的开销原地修改它。

设备上一共有六个工厂方法：

```ts
beam.verts(schema, state?)   // → Verts<V>   — 每个顶点属性对应一个 GPUBuffer
beam.index(state)            // → Index      — uint16/uint32，自动选择
beam.uniforms(schema, state?)// → Uniforms<U>— 一个 std140 打包的 UBO
beam.texture(src?, opts?)    // → Texture
beam.cube(faces?, opts?)     // → Texture (cubemap)
beam.sampler(opts?)          // → Sampler    — 不可变
```

你把它们作为一个按键名组织的 `bindings` 对象传给一次绘制，并会针对管线做类型检查：

```ts
beam.draw(pipe, { verts, index, uniforms, textures, samplers })
```

## 可变的 `.set` 模型

每个数据资源（除 `Sampler` 之外的所有资源）都是**可变且可链式调用的**。
`.set` 会写入已有的 GPU 对象并返回 `this`，因此你只分配一次，
之后每帧都原地更新：

```ts
const uniforms = beam.uniforms(pipe.schema.uniforms, { tint: [1, 1, 1, 1] })

beam.loop((t) => {
  uniforms.set('tint', [Math.sin(t) * 0.5 + 0.5, 0.4, 0.8, 1])
  beam.clear().draw(pipe, { verts, index, uniforms })
})
```

修改内容会复用同一个缓冲区——因此也复用同一个被缓存的绑定组（bind group）。
而分配一个*新*资源则会产生一个新的绑定组。这个区别对于多物体场景很重要；
参见下文的 [每个物体一个 UBO](#one-ubo-per-object)。

## 顶点 —— `beam.verts`

顶点缓冲区是**非交错（non-interleaved）**的：每个属性对应一个 `GPUBuffer`，
按名称作为键。schema 通常就是 `pipe.schema.vertex`，因此键名和 `@location`
顺序总是与管线对齐：

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

`verts.count` 由缓冲区大小推导得出，因此一次非索引（unindexed）的 `draw`
就知道要发出多少个顶点。你可以更新单个属性，也可以一次更新多个：

```ts
verts.set('position', nextPositions)
verts.set({ position: p, color: c })
```

## 索引 —— `beam.index`

`beam.index({ array })` 会上传一个索引缓冲区，并根据最大索引值**自动选择**
`uint16` 或 `uint32`。你可以传入普通的 `number[]` 或一个 typed array：

```ts
const index = beam.index({ array: [0, 1, 2, 0, 2, 3] })
index.count   // 6
index.format  // 'uint16'
```

`count` 和 `offset` 让你能绘制某个子区间；当你用同一个缓冲区表示多个切片时，
可以在 `.set` 中覆盖它们：

```ts
index.set({ array: bigIndexData, offset: 1024, count: 256 })
```

如果 `bindings.index` 存在，则该次绘制为索引绘制；如果省略它，
则为非索引绘制，并使用 `verts.count`。

## Uniform —— `beam.uniforms`

一个 `Uniforms` 资源是**一个** std140 打包的 uniform 缓冲区，绑定在
`@group(0) @binding(0)`。schema 镜像了你 WGSL `struct` 中的字段顺序：

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

你可以按键、按对象，或一次性设置所有字段。未触碰的键会保留其原值：

```ts
uniforms.set('model', modelMatrix)
uniforms.set({ view: viewMatrix, proj: projMatrix })
```

### 嵌套结构体 —— 点号键

如果你的 WGSL uniform 包含嵌套结构体，可以用点号键来定位它们的字段：

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

### std140 / WGSL 打包规则

beam-gpu 会根据 schema 计算每个字段的偏移量，所以你不必手动为缓冲区填充对齐字节——
但你**确实**需要把 WGSL `struct` 声明得和它的布局一致。
下面是 Beam 遵循的规则；请在 WGSL 中遵循同样的规则：

| 类型   | 对齐  | 大小 | 备注                                   |
| ------ | ----- | ---- | -------------------------------------- |
| scalar | 4     | 4    | `f32` / `i32` / `u32`                  |
| `vec2` | 8     | 8    |                                        |
| `vec3` | 16    | 12   | 对齐到 16；尾部有 4 字节的填充         |
| `vec4` | 16    | 16   |                                        |
| `mat2` | 16    | 16   | 2 × `vec2`，带填充                      |
| `mat3` | 16    | 48   | 3 × `vec4` —— **不是** 36              |
| `mat4` | 16    | 64   |                                        |

有两个值得牢记的陷阱：

**`vec3` 携带 4 字节的尾部填充。** 在 `vec3` 之后紧接一个 scalar，
它就会免费地填进那段填充里：

```wgsl
struct Uniforms {
  cameraPos : vec3f,  // 偏移 0，  大小 12
  exposure  : f32,    // 偏移 12 —— 填进 vec3 的填充，零浪费
};
```

**`mat3` 是 48 字节，而不是 36。** 它的三列中每一列都被填充成一个 `vec4`。Beam
会为你处理好这一点：当你 `.set` 一个 `mat3` 时，你传入自然的 **9 个浮点数**，
Beam 会把它们扩展成 12 个浮点数的带填充布局。

```ts
uniforms.set('normalMatrix', nineFloatArray) // 输入 9 个 → 打包输出 12 个
```

::: tip 法线矩阵优先使用 `mat4`
由于 `mat3` 的填充是 std140 中最常见的单个错误，所以推荐的做法
（也是画廊示例的做法）是在方便时把法线矩阵作为 `mat4` 传入，
并在 WGSL 中读取左上角的 `3x3`。这样可以彻底绕开这个陷阱：

```ts
const uniforms = beam.uniforms({ normalMatrix: 'mat4' /* ... */ })
```

```wgsl
struct Uniforms { normalMatrix : mat4x4f, /* ... */ };
let n = mat3x3f(u.normalMatrix[0].xyz, u.normalMatrix[1].xyz, u.normalMatrix[2].xyz);
```
:::

在开发构建中，Beam 会根据 schema 断言计算出的 UBO 大小，并在任何 std140
不匹配时发出警告，因此错误的 WGSL struct 会立即暴露出来。

### 每个物体一个 UBO

`frame` 内的每一次绘制都会被记录到同一个命令编码器（command encoder）中并一起提交，
因此所有 `queue.writeBuffer` 写入都会在任何绘制运行*之前*落地。如果两次连续的绘制
共享**同一个** `uniforms` 资源，那么它们都会读取你最后写入的**那一个**值——
而不是各读各的。

所以多物体场景应该**为每个物体分配一个 `uniforms` 资源**
（或一个每物体的模型矩阵 uniform）。这符合 WebGPU 的正确做法，
而且 Beam 基于标识（identity）的绑定组缓存让这种做法开销很低——
不同的资源会得到不同的被缓存的绑定组：

```ts
const balls = positions.map((p) => ({
  uniforms: beam.uniforms(pipe.schema.uniforms, { model: modelMatrix(p) }),
}))

beam.frame(() => {
  beam.clear()
  for (const ball of balls) beam.draw(pipe, { verts, index, uniforms: ball.uniforms })
})
```

## 纹理 —— `beam.texture`

`beam.texture(source?, opts?)` 创建一个 2D 纹理。source 可以是 `ImageBitmap`、
`HTMLImageElement`、`HTMLCanvasElement`、`HTMLVideoElement`，或原始的
`{ data, width, height }`。你可以现在就传入它，或者先分配一个空纹理，稍后再 `.set`
（在异步加载时很方便）：

```ts
const img = await createImageBitmap(await (await fetch('/wood.png')).blob())
const albedo = beam.texture(img, { srgb: true, flipY: true, mips: true })

// 或者：先分配，图片到达时再填充
const tex = beam.texture()
tex.set(img, { srgb: true })
```

### 纹理选项

| 选项     | 含义                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| `srgb`   | 把图片当作 sRGB 编码的颜色处理（`rgba8unorm-srgb`）。用于颜色贴图；对于数据贴图（法线、粗糙度）请关闭。 |
| `flipY`  | 上传时垂直翻转 —— 让它与你的 UV 约定保持一致。                                 |
| `mips`   | 生成完整的 mip 链。搭配一个 `mip: 'linear'` 的采样器使用。                     |
| `format` | 显式覆盖纹理格式。                                                             |
| `usage`  | 在默认值之外额外的 `GPUTextureUsageFlags`。                                    |

一个 `Texture` 暴露了 `.gpu`（即 `GPUTexture`）、`.view`（一个 `GPUTextureView`）和
`.cube`（这里为 false）。你通过 `bindings.textures` 下的名称来绑定它。

## 立方体贴图 —— `beam.cube`

`beam.cube(faces?, opts?)` 从六个 source 构建一个立方体贴图，按 WebGPU 的面顺序
`[+X, -X, +Y, -Y, +Z, -Z]`。选项和 `TextureOpts` 相同：

```ts
const sky = beam.cube([px, nx, py, ny, pz, nz], { srgb: true, mips: true })
```

在 WGSL 中，立方体贴图是 `texture_cube<f32>`，对应的 schema 类型是 `'texCube'`：

```ts
const env = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3' },
  textures: { sky: 'texCube' }, // → texture_cube<f32>
  samplers: { samp: 'sampler' },
})
```

## 采样器 —— `beam.sampler`

采样器是**不可变的**：没有 `.set`。要改变过滤方式或环绕方式，
你需要创建一个新的。（只有 `.gpu`，即底层的 `GPUSampler`，是暴露出来的。）

```ts
const linear = beam.sampler({
  wrap: 'repeat',  // 或按轴指定：['repeat', 'clamp']
  mag: 'linear',
  min: 'linear',
  mip: 'linear',   // 当纹理有 mip 时启用三线性过滤
})

const shadowSamp = beam.sampler({ compare: 'less' }) // → sampler_comparison
```

`wrap` 接受一个用于所有轴的 `Wrap`，或一个按轴的元组；取值为 `'repeat'`、
`'mirror'`、`'clamp'`。一个 `compare` 函数会产生一个比较采样器
（在 WGSL 中是 `sampler_comparison`），用于阴影映射。

## 绑定纹理和采样器

纹理和采样器位于 `@group(1)`：纹理在前（按 `textures` 的键顺序），
然后是采样器（按 `samplers` 的键顺序）。管线 schema 固定了绑定索引；
你只需提供匹配的、按键名组织的对象即可：

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

## 一个完整的实时示例

一个带动画 uniform 的彩色三角形，通过实时演示宿主连接起来。`setup` 函数
接收一个已经初始化好的 `beam` 和 `canvas`，并返回 `beam.loop` 的 `stop`
以便清理：

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

  // 每帧原地修改 uniform；只分配一次，只有一个绑定组
  return beam.loop((t) => {
    uniforms.set('tint', [Math.sin(t) * 0.5 + 0.5, 0.6, 0.9, 1])
    beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
  })
}
```

## 清理

每个资源都拥有 GPU 内存。对于会动态构建资源的长生命周期应用，
应在用完后调用 `.destroy()`（采样器是不可变的，不需要这么做）。
对于一个存活到导航离开为止的普通页面，`beam.destroy()` 会拆除设备
以及随之而来的一切。

## 下一步

- [绑定与绘制](/zh/guide/bindings-and-draw) —— `bindings` 是如何变成一个绑定组的。
- [WGSL 约定](/zh/guide/wgsl-conventions) —— 完整的 schema → WGSL 映射。
- [管线](/zh/guide/pipeline) —— 这些 schema 从哪里来。
