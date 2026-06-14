---
title: 帧与循环
---

# 帧与循环

现在你已经有了一个管线、一些资源，以及一次 `draw` 调用。最后一个问题是：它*何时*运行。WebGPU 从不"立即"绘制——它把命令记录进一个编码器，然后作为一个批次提交。Beam 忠实地保留了这个模型，但把其中两个纯粹的样板步骤隐藏了起来。

## 一帧就是一个函数

原生 WebGPU 要求你每帧都重复写出同样的六个步骤：

```ts
const encoder = device.createCommandEncoder()
const pass = encoder.beginRenderPass({ /* ...attachments... */ })
// ...record draws...
pass.end()
device.queue.submit([encoder.finish()])
```

其中两个步骤——创建/结束编码器，以及 `queue.submit`——每帧都只有唯一一种合理的写法。`beam.frame(cb)` *只*移除了这两个：

```ts
beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

在回调内部，编码器处于打开状态；当回调返回时，Beam 会结束并提交。你在这之间做的一切，都会被记录进这一帧。回调会接收到当前的时间戳（一个以毫秒为单位的 `DOMHighResTimeStamp`），这对动画很有用：

```ts
beam.frame((t) => {
  uniforms.set('time', t / 1000)
  beam.clear().draw(tri, { verts, index, uniforms })
})
```

### `frame` 隐藏了什么——又没有隐藏什么

`frame` 隐藏的是**编码器**和**提交**。它并*没有*隐藏渲染**通道**（pass）。这是有意为之的：通道是一个真实存在的 WebGPU 概念，假装它不存在只会让你学到错误的 WebGPU。

通道只是在常规路径上被保持为隐式而已。当你在一帧中第一次向屏幕绘制时，Beam 会为你打开默认的屏幕通道；`beam.clear()` 则设置它的 `loadOp`。相比之下，离屏通道是一个显式的 [`Target`](/zh/guide/targets)——你需要通过名称主动选用它。所以：

- 编码器生命周期 + 提交——**隐藏**（每帧唯一一种写法）。
- 屏幕渲染通道——**隐式但存在**（它正是 `clear().draw()` 记录的目标）。
- 离屏通道——**显式**（`beam.target(...)`）。

## 用 `loop` 制作动画

单独一帧往往不够用。`beam.loop(cb)` 会在一个 `requestAnimationFrame` 循环中运行你的回调，并返回一个 `stop()` 函数。每一个 tick 都会得到时间戳 `t` 以及自上一帧以来的增量 `dt`（两者均以毫秒为单位）：

```ts
const stop = beam.loop((t, dt) => {
  uniforms.set('time', t / 1000)
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})

// Later, to tear down:
stop()
```

每个 tick 都是它自己的一个 `frame`：编码器打开，你的绘制被记录，然后 Beam 提交——接着等待下一个动画帧。你永远不需要管理 `rAF` 句柄，也不用调用 `cancelAnimationFrame`；`stop()` 会替你完成这些。

下面是一个实时旋转的三角形，它在着色器中通过一个 `time` uniform 进行旋转：

<BeamCanvas :setup="setup" />

```ts
import { Beam } from 'beam-gpu'
import wgsl from './spin.wgsl?raw'

const beam = await Beam.gpu(canvas)

const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { time: 'f32' }
})

const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms)

const stop = beam.loop((t) => {
  uniforms.set('time', t / 1000)
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

```wgsl
// spin.wgsl
struct Uniforms {
  time : f32,
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
  let a = u.time;
  let r = mat2x2f(cos(a), -sin(a), sin(a), cos(a));
  var out : VsOut;
  out.pos = vec4f(r * position.xy, position.z, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  return vec4f(in.color, 1.0);
}
```

## 清屏与 loadOp 的默认行为

默认情况下，每个绘制表面在每帧开始时都会被清为黑色。规则如下（DESIGN §3.6）：

- 不带参数的 `beam.clear()` 会清为 `[0, 0, 0, 1]`，深度为 `1`。
- 如果你在一帧中向某个表面绘制时*没有*先调用 `clear()`，该表面这一帧的第一个通道仍会使用 `loadOp: 'clear'` 清为 `[0, 0, 0, 1]`——这样你就永远不会意外读取到帧缓冲区中的陈旧内容。
- 一旦某个通道已经打开，后续向它的绘制会执行 `load`（累加）而不是重新清屏。
- 显式的 `clear(color)` 会覆盖颜色；传入第二个参数可以设置深度清除值。

```ts
beam.frame(() => {
  beam
    .clear([0.1, 0.1, 0.12, 1]) // clear once, to a dark slate
    .draw(tri, { verts, index, uniforms })
    .draw(tri2, { verts: verts2, index: index2, uniforms: uniforms2 }) // loads
})
```

`clear` 返回设备本身，因此它可以直接链式调用到 `draw`。同样的链式写法也可以通过 `target.clear().draw(...)` 作用在一个 [`Target`](/zh/guide/targets) 上。

## 进阶路径：`beam.pass()`

`frame` + `clear` + `draw` 已经覆盖了画廊中的所有内容。当你需要隐式通道无法提供的控制能力时——比如一个编码器中包含多个通道、视口（viewport）或裁剪矩形（scissor rect），又或者你想自己驱动提交——就向下降一层，使用 `beam.pass()`。

`beam.pass(opts?)` 返回一个 `Pass`：它是对真实 `GPURenderPassEncoder` 的一层轻量封装（可通过 `pass.gpu` 访问，并通过 `pass.encoder` 访问底层的 `GPUCommandEncoder`）。你需要自己向它记录命令并结束它：

```ts
const pass = beam.pass({ clear: [0, 0, 0, 1] })
pass
  .viewport(0, 0, 200, 400)
  .draw(tri, { verts, index, uniforms })
  .end()
  .submit()
```

`PassOpts` 允许你把通道指向一个离屏的 `Target`、设置清屏颜色（或设为 `null` 以执行 `load` 而非清屏）、设置 `clearDepth`，或复用一个已有的 `GPUCommandEncoder`：

```ts
interface PassOpts {
  target?: Target                                   // offscreen, default screen
  clear?: [number, number, number, number] | null   // null = loadOp 'load'
  clearDepth?: number | null
  encoder?: GPUCommandEncoder                         // share an encoder
}
```

一个 `Pass` 暴露了 `clear()`、`draw()`、`viewport()`、`scissor()`、`end()` 和 `submit()`。此时你需要自己负责原本由 `frame` 处理的生命周期——调用 `end()` 来关闭通道，调用 `submit()` 来刷新编码器。如果你传入自己的 `encoder`，你可以向它记录多个通道，然后只 `submit()` 一次。

这两个层次其实是同一个模型在不同高度上的呈现：

| 你想要的…                                  | 使用                          |
|--------------------------------------------|------------------------------|
| 一帧屏幕渲染，简洁                          | `beam.frame(() => …)`        |
| 一个动画循环                                | `beam.loop((t, dt) => …)`    |
| 离屏渲染到纹理                              | `beam.target(opts)`          |
| 视口/裁剪、多通道、手动提交                  | `beam.pass(opts)`            |

当你确实"长大到" `frame` 已经不够用时再去使用 `pass()`，不要操之过急——而且即便到了那时，当你需要原生 WebGPU 时，`pass.gpu` 和 `pass.encoder` 也都触手可及。

<script setup>
import wgsl from '../../.vitepress/snippets/spin.wgsl?raw'

const setup = async ({ beam, canvas }) => {
  const tri = beam.pipeline({
    wgsl,
    vertex: { position: 'vec3', color: 'vec3' },
    uniforms: { time: 'f32' }
  })
  const verts = beam.verts(tri.schema.vertex, {
    position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
    color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
  })
  const index = beam.index({ array: [0, 1, 2] })
  const uniforms = beam.uniforms(tri.schema.uniforms)

  return beam.loop((t) => {
    uniforms.set('time', t / 1000)
    beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
  })
}
</script>
