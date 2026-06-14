---
title: WGSL 约定
---

# WGSL 约定

Beam 从不改写你的着色器。你交给它一个 WGSL 模块，它则根据 pipeline schema 计算出
顶点缓冲区布局和绑定组布局。作为交换，你的 WGSL 需要遵循**一套固定的约定**，这样两边
才能对齐。本页就是这套约定的完整参考。

这份契约小到足以记在脑子里：

- **顶点属性**按照 schema 键的顺序变成一个个 `@location`。
- **Uniform** 汇聚成 `@group(0) @binding(0)` 处的一个 std140 结构体。
- **先纹理后采样器**，都放在 `@group(1)` 里。

下文就是对这三条规则的展开。

## 一个模块，两个入口点

一个 pipeline 就是一个 WGSL 模块，包含一个 `vs` 入口点和一个 `fs` 入口点。你手写它，
并用 `?raw` 导入：

```ts
import wgsl from './hello.wgsl?raw'

const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})
```

默认的入口点名称是 `vs` 和 `fs`。如果你在一个文件里保留了多种技术（technique），可以
用 `vsEntry` / `fsEntry` 为每个 pipeline 单独覆盖它们。

## 顶点属性 → `@location`，按 schema 键顺序

`vertex` schema 的键**按声明顺序**映射到 `@location(0)`、`@location(1)`、……。每个
属性对应一个 `GPUBuffer`（非交错，stride = 属性大小，offset 0），所以顺序纯粹决定了每个
键占用哪个 `@location`——而与打包（packing）无关。

给定这个 schema：

```ts
vertex: { position: 'vec3', color: 'vec3' }
```

`position` 是 `@location(0)`，`color` 是 `@location(1)`：

```wgsl
@vertex
fn vs(
  @location(0) position : vec3f,  // vertex.position
  @location(1) color    : vec3f,  // vertex.color
) -> VsOut { /* ... */ }
```

### 顶点类型映射表

schema 类型同时确定了你要写的 WGSL 类型，以及 Beam 为你推导出的 `GPUVertexFormat`。
顶点属性接受标量和向量（矩阵属于 uniform，而非属性）：

| Schema type | WGSL type | GPUVertexFormat |
|-------------|-----------|-----------------|
| `'f32'`     | `f32`     | `float32`       |
| `'vec2'`    | `vec2f`   | `float32x2`     |
| `'vec3'`    | `vec3f`   | `float32x3`     |
| `'vec4'`    | `vec4f`   | `float32x4`     |
| `'i32'`     | `i32`     | `sint32`        |
| `'u32'`     | `u32`     | `uint32`        |

## Uniform → `@group(0) @binding(0)`，一个 std140 UBO

一个 pipeline 的所有 uniform 都打包进 `@group(0) @binding(0)` 处的**单个** uniform
缓冲区。你声明一个 WGSL `struct`，其字段顺序对应 `uniforms` schema 的顺序，Beam 则让
`beam.uniforms(...)` 的写入与之匹配。

```ts
uniforms: { tint: 'vec4' }
```

```wgsl
struct Uniforms {
  tint : vec4f,            // uniforms.tint
};
@group(0) @binding(0) var<uniform> u : Uniforms;
```

### Uniform 类型映射表

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

### std140 对齐中那些会咬人的地方

WebGPU 的 uniform 缓冲区遵循 std140 风格的对齐。两条规则覆盖了其中的大部分情况：

- **`vec3` 对齐到 16，但只填满 12。** 在 `vec3` 之后紧跟一个标量，让它占据末尾那 4 字节
  的填充——否则下一个字段会跳到下一个 16 字节边界，你的偏移量就会错位。
- **矩阵按列填充。** `mat3` 是**三个 `vec4` 列**（48 字节，而非 36）；`mat2` 是两个
  `vec2` 列（16 字节）；`mat4` 则是规整的 64 字节。当你对一个 `mat3` 调用
  `.set('normalMatrix', m)` 时，你传入自然的 9 个浮点数，Beam 会为你把它们扩展成 12 个
  浮点数的填充布局。

```wgsl
struct Uniforms {
  model      : mat4x4f,   // uniforms.model       — 64 字节
  normalMat  : mat3x3f,   // uniforms.normalMatrix — 48 字节（3 个 vec4）
  lightDir   : vec3f,     // uniforms.lightDir     — 对齐到 16，填满 12……
  intensity  : f32,       // uniforms.intensity    — ……这个填满那段填充
};
@group(0) @binding(0) var<uniform> u : Uniforms;
```

::: tip 避开 mat3 陷阱
`mat3` 法线矩阵是经典的 std140 大坑。在方便的场合，把它在 schema 和 WGSL 里都声明为
`mat4`，并以 16 个浮点数传入矩阵——填充问题就消失了。
:::

嵌套结构体在 `.set` 上用**点号键**寻址：

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

在开发模式下，Beam 会把计算出的 UBO 大小与 schema 比对，并在 std140 不匹配时发出警告，
这样顺序错乱的结构体能被及早发现。

## 先纹理后采样器 → `@group(1)`

纹理和采样器共享 `@group(1)`。**纹理在前**——按 `textures` 键顺序从 `@binding(0)` 到
`@binding(T-1)`——然后采样器接着从 `@binding(T)` 到 `@binding(T+S-1)`，按 `samplers`
键顺序排列。

```ts
const pipe = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', uv: 'vec2' },
  uniforms: { mvp: 'mat4' },
  textures: { albedo: 'tex2d', normal: 'tex2d' },
  samplers: { samp: 'sampler' }
})
```

有两个纹理（`T = 2`）和一个采样器时，绑定如下：

```wgsl
@group(1) @binding(0) var albedo : texture_2d<f32>;   // textures.albedo
@group(1) @binding(1) var normal : texture_2d<f32>;   // textures.normal
@group(1) @binding(2) var samp   : sampler;           // samplers.samp
```

### 纹理与采样器类型映射表

| Schema type        | WGSL type              |
|--------------------|------------------------|
| `'tex2d'`          | `texture_2d<f32>`      |
| `'texCube'`        | `texture_cube<f32>`    |
| `'texDepth'`       | `texture_depth_2d`     |
| `'sampler'`        | `sampler`              |
| `'samplerCompare'` | `sampler_comparison`   |

## 文件布局约定

每个 pipeline 保留一个 `.wgsl` 文件，用 `?raw` 导入，并把模块从上到下按如下顺序排列：

1. `Uniforms` 结构体（以及它需要的任何嵌套结构体）。
2. `@group(0)` / `@group(1)` 的绑定。
3. `@vertex` 入口点。
4. `@fragment` 入口点。

给每个绑定都注释上它所对应的 schema 键。正是这一个小习惯，让 WGSL 一侧和 TypeScript 一侧
忠实地保持同步。

## 完整的带注释示例

下面是一个完整、自包含的 pipeline，它用到了每一个组：顶点属性、一个 uniform 结构体
（其中刻意放了一个跟在 `vec3` 之后的标量）、一个纹理和一个采样器。

TypeScript 部分：

```ts
import { Beam } from 'beam-gpu'
import wgsl from './lit.wgsl?raw'

const beam = await Beam.gpu(canvas)

const lit = beam.pipeline({
  wgsl,
  // 键 -> @location(0), @location(1), @location(2)
  vertex: { position: 'vec3', normal: 'vec3', uv: 'vec2' },
  // @group(0) @binding(0) 处的一个 std140 UBO
  uniforms: { mvp: 'mat4', lightDir: 'vec3', ambient: 'f32' },
  // 先纹理后采样器，都在 @group(1) 里
  textures: { albedo: 'tex2d' },
  samplers: { samp: 'sampler' }
})
```

与之匹配的 `lit.wgsl`——注意每个绑定的注释是如何标明其 schema 键的：

```wgsl
// lit.wgsl — binding convention (DESIGN §4)
//   vertex   { position, normal, uv } -> @location(0,1,2)
//   uniforms { mvp, lightDir, ambient } -> @group(0) @binding(0)
//   textures { albedo } + samplers { samp } -> @group(1) @binding(0,1)

struct Uniforms {
  mvp      : mat4x4f,   // uniforms.mvp      — 64 字节
  lightDir : vec3f,     // uniforms.lightDir — 对齐 16，填满 12……
  ambient  : f32,       // uniforms.ambient  — ……填满 vec3 的那段填充
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

这就是整套约定。一旦 schema 和 WGSL 在顺序上达成一致，Beam 推导出的布局和你手写的着色器
就会在正中间精确相遇——而且一次 draw 调用的 `bindings` 对象会针对该 pipeline 做完整的
类型检查。

## 另请参阅

- [Pipeline](/zh/guide/pipeline) —— 驱动这些布局的 schema。
- [Resources](/zh/guide/resources) —— `verts`、`uniforms`、`texture`、`sampler`。
- [Bindings & Draw](/zh/guide/bindings-and-draw) —— 把这些数据交给一次 draw。
