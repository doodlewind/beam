---
title: 快速开始
---

<script setup>
import wgsl from '../../../examples/pages/basic-graphics/hello-world/hello.wgsl?raw'

// BeamCanvas 会把一个已经初始化好的 `beam` 设备连同 `canvas` 交给我们。
// 我们只需构建管线、数据，并绘制一帧。这正是下文讲解的主体，
// 只是少了 `await Beam.gpu(canvas)` 这一行（BeamCanvas 已替我们做过了）。
const setup = ({ beam }) => {
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
}
</script>

# 快速开始

本页带你从一个空文件夹，走到屏幕上一个彩色三角形。它就是 Beam 示例里随附的那个
hello-world，这里会逐行讲解。

这就是我们要做的东西——一个实时版本，此刻正在你的浏览器里运行：

<BeamCanvas :setup="setup" :width="400" :height="400" />

## 环境要求

Beam 是**原生 WebGPU**，因此你需要一个支持 WebGPU 的浏览器：

- **Chrome / Edge 113+** —— 在 Windows、macOS 与 ChromeOS 上默认启用。
- **Safari 18+**（macOS Sequoia、iOS 18）—— 默认启用。
- **Firefox** —— 可用；必要时启用 `dom.webgpu.enabled`。

你可以在运行时通过 `navigator.gpu` 检查支持情况。如果它不存在，说明浏览器无法运行 WebGPU，
Beam 的 `await Beam.gpu(canvas)` 将会拒绝（reject）。

```ts
if (!navigator.gpu) {
  throw new Error('WebGPU is not available in this browser.')
}
```

## 安装

```bash
npm i beam-gpu
```

Beam 以 ES 模块发布，内置 TypeScript 类型。它没有任何运行时依赖——它是对 WebGPU API 一层
轻薄而诚实的封装。

```ts
import { Beam } from 'beam-gpu'
```

## Hello World

我们将渲染一个三角形，它的三个角分别是红、绿、蓝，并由 GPU 在三角面上插值这些颜色。两个
文件：一个 WGSL 着色器，加一小段 TypeScript。这就是整个应用。

### 着色器（`hello.wgsl`）

Beam 从不改写你的着色器——你手写一个 WGSL 模块，带有 `vs` 和 `fs` 两个入口点。绑定遵循
[Beam 的 WGSL 约定](/zh/guide/wgsl-conventions)：顶点属性按模式键顺序映射到各个 `@location`，
而 uniform 块位于 `@group(0) @binding(0)`。

```wgsl
// Colored triangle. Binding convention (DESIGN §4):
//   vertex schema { position, color } -> @location(0), @location(1)
//   uniforms schema { tint }          -> @group(0) @binding(0)
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

顶点阶段把每个顶点的 `color` 透传出去；片元阶段接收插值后的颜色，并把它乘上一个全局的
`tint` uniform（这里是白色，所以颜色原样通过）。

### 脚本（`main.ts`）

```ts
import { Beam } from 'beam-gpu'
import wgsl from './hello.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

// 异步初始化：一次 await 完成 adapter + device + 上下文配置。
const beam = await Beam.gpu(canvas)

// 管线 = WGSL + 各项模式。顶点键的顺序就是 @location 顺序；
// `tint` 会打包进 @group(0) 的 uniform 缓冲。
const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})

// 顶点缓冲，按属性名作键（可通过 .set 修改）。
const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })

// 一帧：先清屏，再绘制。bindings 对象会依据 `tri` 做类型检查。
beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

这就是整个程序。我们来逐步看看每一步做了什么。

### 第 1 步 —— 拿到画布并设定尺寸

```ts
const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400
```

Beam 绘制到一个属于你的 `<canvas>` 上。尺寸由你掌控——除非你通过
`Beam.gpu(canvas, { hidpi: true })` 主动开启 HiDPI，否则 Beam 不会去动它。

### 第 2 步 —— 创建设备

```ts
const beam = await Beam.gpu(canvas)
```

`Beam.gpu` 是**异步的**：在一次 `await` 里，它获取 GPU 适配器与设备，读取画布的首选纹理
格式，并配置画布上下文。返回的 `beam` 就是你之后一切操作的句柄。如果你需要原始的 WebGPU
对象，它们就在那里：`beam.device`、`beam.adapter`、`beam.ctx`、`beam.format`、`beam.canvas`。

### 第 3 步 —— 构建管线

```ts
const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})
```

一个 `pipeline` 把你的 WGSL 模块与描述其输入的**模式（schema）**配对在一起。从这一份声明，
Beam 推导出三样东西：TypeScript 类型、GPU 顶点缓冲布局（`vertex` 键的顺序*就是* `@location`
的顺序），以及绑定组布局（`uniforms` → `@group(0)`）。这些模式也通过 `tri.schema.vertex` 与
`tri.schema.uniforms` 暴露出来，让你的资源与管线保持同步。

### 第 4 步 —— 造数据（资源）

```ts
const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })
```

资源是持久的 GPU 对象，你用普通数组把它们填满：

- **`beam.verts`** —— 每个属性一个缓冲，按名作键。`position` 保存裁剪空间中的三个角；
  `color` 为每个角保存一个 RGB（红、绿、蓝）。顶点数会被自动推断。
- **`beam.index`** —— 三角形的顶点顺序 `[0, 1, 2]`。Beam 会自动为你选择 `uint16` 或
  `uint32`。
- **`beam.uniforms`** —— 一个按 std140 打包的 uniform 缓冲。这里是单个 `tint`，设为不透明
  的白色。

每个资源都可变且可链式调用 `.set(...)`，因此你之后可以更新数据，而无需重建任何东西。

### 第 5 步 —— 绘制一帧

```ts
beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

`beam.frame(cb)` 打开每帧的命令编码器，运行你的回调，然后提交——它只隐藏纯属仪式的部分
（编码器生命周期与 `queue.submit`）。

在内部，两个动词完成了工作。`beam.clear([0, 0, 0, 1])` 把屏幕清成黑色，并返回 `beam`，
方便你链式调用。`beam.draw(tri, { ... })` 记录一次绘制：你把管线和一个单一的**带键 bindings
对象**交给它。WebGPU 是按组与索引绑定的，而不是按名字或顺序，所以数据就是一个对象——
`{ verts, index, uniforms }`——并依据 `tri` 的模式做完整的类型检查。

这就是你的三角形。从这里出发，可以去 [管线](/zh/guide/pipeline) 深入了解模式，或去
[帧与循环](/zh/guide/frame-and-loop) 让它动起来。
