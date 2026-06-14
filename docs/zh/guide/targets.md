---
title: 渲染目标
---

# 渲染目标（Targets）

到目前为止，所有的绘制都落到了屏幕上。**target（渲染目标）**就是同一个渲染
通道，只不过它指向一张*离屏*纹理，而不是画布。你向它绘制的方式和向屏幕绘制
完全一样——`clear().draw(...)`——然后在后续的绘制中采样它的结果。仅凭这一个
思路，就解锁了后处理、阴影贴图、反射，以及任何多通道（multi-pass）效果。

```ts
const target = beam.target({ width: 1024, height: 1024 })
```

一个 `Target` 拥有一张可采样的颜色纹理（`target.color`），并且在你需要时还
拥有一张可采样的深度纹理（`target.depth`）。它用和设备相同的链式动词来记录
绘制，所以没有任何新东西要学：

```ts
target.clear([0, 0, 0, 1]).draw(scene, { verts, index, uniforms })
```

## 创建一个 target

`beam.target(opts)` 接受一个小小的配置对象：

```ts
const target = beam.target({
  width: 1024,
  height: 1024,
  depth: true,            // 同时分配一张可采样的深度纹理
  format: 'rgba8unorm',   // 颜色格式；默认使用画布格式
  samples: 1,             // 1（默认）或 4（用于 MSAA）
  label: 'scene'
})
```

- `width` / `height` 是必需的——target 没有画布可供它推算自身尺寸。
- `depth: true` 会添加 `target.depth`。对于纯 2D / 后处理通道，不开启即可。
- `format` 默认为 `beam.format`（首选的画布格式）。当你有需要时，选择一个
  明确的格式，例如 `'rgba16float'` 用于 HDR。
- `samples: 4` 会开启 MSAA。Beam 渲染到一张内部的多重采样纹理中，并将其解析
  （resolve）到单采样的 `target.color`，因此你之后采样到的内容始终是已解析、
  可采样的。

## 向 target 中绘制

target 的绘制方式和 `beam` 完全相同。在一个 `frame` 内部，先清空它，再记录
绘制——这套记录 API 就是相同的 `Target.clear` / `Target.draw` 链：

```ts
beam.frame(() => {
  // 通道 1 —— 把场景渲染到离屏的颜色纹理中。
  target
    .clear([0, 0, 0, 1])
    .draw(scene, { verts, index, uniforms })

  // 通道 2 —— 绘制到屏幕上，采样通道 1 的结果。
  beam
    .clear()
    .draw(present, {
      verts: quadVerts,
      textures: { src: target.color },
      samplers: { samp }
    })
})
```

两个通道都被编码进同一帧并一起提交。你书写这些调用的顺序就是它们执行的顺序，
所以你在前面绘制进去的 target，在同一帧的后面就已经可以被采样了。

::: tip 一个 target，两种角色
`target.color` 是一张普通的 `Texture`。把它通过 `bindings.textures` 交给某次
绘制，就和你用 `beam.texture(...)` 加载的任何图像一样。对于深度 target，使用
`target.depth`（在 WGSL 中是一个 `texture_depth_2d`）。
:::

## 一个完整的双通道示例

先离屏渲染一个三角形，然后把它采样到屏幕上的一个全屏四边形上。片元着色器会
反转颜色，作为任意后处理效果的占位示意。

```ts
import { Beam } from 'beam-gpu'
import sceneWgsl from './scene.wgsl?raw'
import postWgsl from './post.wgsl?raw'

const canvas = document.querySelector('canvas')!
canvas.width = 512
canvas.height = 512
const beam = await Beam.gpu(canvas)

// 我们把场景渲染进去的那张离屏表面。
const target = beam.target({ width: 512, height: 512 })

// 通道 1 的管线：熟悉的彩色三角形。
const scene = beam.pipeline({
  wgsl: sceneWgsl,
  vertex: { position: 'vec3', color: 'vec3' }
})
const sceneVerts = beam.verts(scene.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const sceneIndex = beam.index({ array: [0, 1, 2] })

// 通道 2 的管线：把 target 的颜色采样到一个四边形上。
const post = beam.pipeline({
  wgsl: postWgsl,
  vertex: { position: 'vec2' },
  textures: { src: 'tex2d' },
  samplers: { samp: 'sampler' }
})
const quad = beam.verts(post.schema.vertex, {
  position: [-1, -1, 1, -1, -1, 1, 1, 1]
})
const quadIndex = beam.index({ array: [0, 1, 2, 2, 1, 3] })
const samp = beam.sampler({ min: 'linear', mag: 'linear' })

beam.frame(() => {
  target
    .clear([0.1, 0.1, 0.1, 1])
    .draw(scene, { verts: sceneVerts, index: sceneIndex })

  beam
    .clear()
    .draw(post, {
      verts: quad,
      index: quadIndex,
      textures: { src: target.color },
      samplers: { samp }
    })
})
```

后处理着色器遵循 WGSL 约定——在 `@group(1)` 中有一张纹理和一个采样器：

```wgsl
// post.wgsl
// vertex schema { position }        -> @location(0)
// textures { src }  + samplers { samp } -> @group(1)
@group(1) @binding(0) var src  : texture_2d<f32>;
@group(1) @binding(1) var samp : sampler;

struct VsOut {
  @builtin(position) pos : vec4f,
  @location(0)       uv  : vec2f,
};

@vertex
fn vs(@location(0) position : vec2f) -> VsOut {
  var out : VsOut;
  out.pos = vec4f(position, 0.0, 1.0);
  // 把裁剪空间 [-1,1] 映射到 UV [0,1]；翻转 Y 让图像正立。
  out.uv = vec2f(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  let c = textureSample(src, samp, in.uv);
  return vec4f(1.0 - c.rgb, 1.0); // 反转颜色，作为后处理效果示例
}
```

## 一帧中的多个通道

target 是可以组合的。按效果所需链接任意多个离屏通道，每个通道采样上一个的
结果，最后落到屏幕上。因为这一切都记录在单个 `frame` 内部，中间纹理永远不会
触碰画布：

```ts
beam.frame(() => {
  sceneTarget.clear([0, 0, 0, 1]).draw(scene, sceneBindings)

  blurX
    .clear()
    .draw(blur, { verts: quad, index: quadIndex,
      textures: { src: sceneTarget.color }, samplers: { samp } })

  blurY
    .clear()
    .draw(blur, { verts: quad, index: quadIndex,
      textures: { src: blurX.color }, samplers: { samp } })

  beam
    .clear()
    .draw(present, { verts: quad, index: quadIndex,
      textures: { src: blurY.color }, samplers: { samp } })
})
```

## 在两个 target 之间乒乓（ping-pong）

迭代式的效果——高斯模糊、流体模拟、经典的生命游戏（Game of Life）——会读取
一张纹理并写入另一张，然后交换。一个 target 不能在同一个通道里既被采样又被
写入，所以你保留**两个** target，在它们之间来回乒乓：

```ts
let read = beam.target({ width: 512, height: 512 })
let write = beam.target({ width: 512, height: 512 })

beam.loop(() => {
  // 一个模拟步：采样 `read`，渲染进 `write`。
  write
    .clear()
    .draw(step, {
      verts: quad,
      index: quadIndex,
      textures: { state: read.color },
      samplers: { samp }
    })

  // 把刚刚写好的状态呈现到屏幕上。
  beam
    .clear()
    .draw(present, {
      verts: quad,
      index: quadIndex,
      textures: { src: write.color },
      samplers: { samp }
    })

  // 交换：下一帧读取我们刚刚写入的内容。
  ;[read, write] = [write, read]
})
```

::: warning 采样一个 target，或写入它——绝不能同时进行
一个读取 `read.color` 的通道不能同时绘制进 `read`。保留各自独立的读 target
和写 target，并交换它们。对于状态纹理（细胞自动机、数据通道），采样器过滤
通常应为 `nearest`；对于图像效果则用 `linear`。
:::

## 调整尺寸与清理

target 的尺寸是显式指定的，所以当画布发生变化时，你需要自己调整它们的尺寸：

```ts
window.addEventListener('resize', () => {
  beam.resize()
  target.resize(canvas.width, canvas.height)
})
```

当不再需要某个 target 时，用 `target.destroy()` 释放它的 GPU 纹理。

## 从旧版 Beam 迁移

旧版 Beam 用位置参数 `width, height` 创建 target，并通过 `target.use(cb)`
回调来重定向绘制，然后暴露单一的 `target.texture`：

```js
// 旧版（beam-gl）
const target = beam.target(2048, 2048)
beam.clear()
target.use(() => {
  beam
    .draw(shaderX, ...resourcesA)
    .draw(shaderY, ...resourcesB)
})
myTextures.set('img', target.texture)
```

在 beam-gpu 中，选项采用键名传递，target *本身*就是绘制表面（没有 `use`
包装器——它有自己的 `clear`/`draw`），并且颜色和深度是各自独立的可采样纹理：

```ts
// 新版（beam-gpu）
const target = beam.target({ width: 2048, height: 2048, depth: true })

beam.frame(() => {
  target
    .clear()
    .draw(shaderX, bindingsA)
    .draw(shaderY, bindingsB)

  // 在后续的绘制中采样结果。
  beam.draw(present, {
    verts, index,
    textures: { img: target.color },   // 原来是 target.texture
    samplers: { samp }
  })
})
```

| 旧版 beam-gl | beam-gpu |
|-------------|----------|
| `beam.target(w, h, depth)` | `beam.target({ width, height, depth?, format?, samples? })` |
| `target.use(cb)` | `target.clear().draw(pipe, bindings)` —— 与 `beam.draw` 相同的链式调用 |
| `target.texture` | `target.color`（以及用于可采样深度的 `target.depth`） |
| `textures.set('img', target.texture)` | `bindings.textures = { img: target.color }` |

如果需要 power-path 的等价写法（你自己的命令编码器、显式的
`pass.end()` / `submit()`），请参阅 [Frame & Loop](/zh/guide/frame-and-loop) 和
`beam.pass({ target })`。
