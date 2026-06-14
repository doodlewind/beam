---
title: 什么是 Beam？
---

# 什么是 Beam？

Beam 是一个小巧、易学的 WebGPU 库。它**不是**渲染器，也不是 3D 引擎——它不附带场景图、
材质系统，也不带数学库。相反，它在裸 WebGPU 之上提供了少量诚实的抽象，让你用十几行代码就能
画出一个三角形，同时仍然清楚地看到 GPU 究竟在做什么。

WebGPU 很强大，但很啰嗦：画一个三角形意味着要准备适配器（adapter）、设备（device）、上下文
（context）、管线（pipeline）、绑定组布局（bind group layouts）、绑定组（bind groups）、命令
编码器（command encoder）、渲染通道（render pass），还有一次队列提交（queue submit）。正如
当年 jQuery 包装了 DOM，Beam 以简洁的方式包装了 WebGPU——但绝不对底层模型撒谎。每个 Beam 动词
都与真实的 WebGPU 调用**一一对应**，每个 Beam 句柄都暴露其原始对象（`pipeline.gpu`、
`verts.buffers`、`beam.device`）。当你不再满足于 Beam 时，无需重新学习，就能下沉一层进入纯
WebGPU。

## 心智模型：五个名词，两个动词

WebGPU 真实的形状是 `device → pipeline + bind groups → encoder → render pass → draw`。
Beam 让其中的每一项都保持可见，只隐藏了两块纯属仪式的部分：命令编码器的生命周期，以及
`queue.submit`。剩下的，就是**五个名词**和**两个动词**。

| 名词 | 它包装了什么 | 如何创建 |
| --- | --- | --- |
| **Beam**（设备） | `GPUAdapter` + `GPUDevice` + 画布上下文 | `await Beam.gpu(canvas)` |
| **Pipeline**（管线） | `GPURenderPipeline` 及其绑定组布局 | `beam.pipeline(template)` |
| **resources**（资源） | 持久的 `GPUBuffer` / `GPUTexture` / 采样器 | `beam.verts` / `beam.index` / `beam.uniforms` / `beam.texture` / `beam.sampler` |
| **Bindings**（绑定） | 一次绘制所需的数据（→ 一个 `GPUBindGroup`） | 一个普通的带键对象 |
| **Target**（渲染目标） | 一个离屏渲染通道 + 可采样纹理 | `beam.target(opts)` |

两个动词是：**`frame(cb)`**，它打开每帧的命令编码器、运行你的绘制、并提交；以及
**`draw(pipeline, bindings)`**，它记录一次绘制。日常读起来就是一行：

```ts
beam.frame(() =>
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
)
```

这就是整个 API 的缩影：资源只创建一次，然后把每次绘制描述成「一个管线 + 一个带键的
`bindings` 对象」。这些键（`verts`、`index`、`uniforms`、`textures`、`samplers`）会被
TypeScript 依据管线的模式做检查，因此一次不匹配的绘制会在编译期失败，而不是变成一条晦涩的
GPU 校验错误。

## 你好，三角形

下面是一个完整、彩色的三角形。管线只声明一次它的模式；这一份声明同时驱动了 TypeScript 类型、
顶点缓冲布局，以及绑定组布局。

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

// 资源是持久的 GPU 对象，可通过 .set() 修改。
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

与之配套的 WGSL 是手写的——Beam 从不改写或生成着色器代码。它只遵循一条固定约定：顶点属性按
模式键的顺序成为各个 `@location`，而 uniforms 成为一个位于 `@group(0) @binding(0)` 的单一
结构体。

```wgsl
// vertex schema { position, color } -> @location(0), @location(1)
// uniforms schema { tint }          -> @group(0) @binding(0)
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

运行它，你就得到了下面这个——一个实时演示，就在你的浏览器里，用真正的 beam-gpu 和 WebGPU
渲染：

<BeamCanvas :setup="triangle" />

<script setup>
import wgsl from './hello.wgsl?raw'

const triangle = async ({ beam }) => {
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

> 上面的 WGSL 在本页演示中是以字符串形式内联的。在真实项目里，你会把它放进一个 `.wgsl`
> 文件，并用 `?raw` 导入，就和代码示例里展示的一样。

## WebGPU 的形状

WebGPU 由显式、受校验的对象构成，Beam 拥抱这套模型，而非隐藏它：

- **显式、受校验的对象**，取代了隐式状态。一个管线把它的着色器、顶点布局和渲染状态打包进一个
  不可变对象，因此不会有游离的状态在绘制之间泄漏。
- **绑定组**通过 `@group` 与 `@binding` 索引来描述资源——这是数据与着色器之间清晰、可缓存的
  契约。
- **WGSL**，一门为现代 GPU 设计的强类型着色语言。
- 它在底层运行于 Vulkan / Metal / D3D12 之上，并已在 Chrome、Edge 与 Safari 中发布。

Beam 唯一移除的东西——每帧那套命令编码器的繁文缛节——恰恰是 WebGPU 中每帧都只有一种合理形态的
部分。其余一切都保持为一等概念。

有三处设计值得特别点出。初始化是**异步的**，因为获取 GPU 适配器与设备本身就是异步的。一次
绘制的数据是一个**带键对象**，而非位置参数展开，因为 WebGPU 是按组与绑定索引来绑定的，而不是
按参数顺序——而且这些键让 TypeScript 能检查调用处。还有，**帧是显式的**：你的绘制位于
`beam.frame(cb)`（或由 rAF 驱动的 `beam.loop(cb)`）之内，它会编码并提交一帧的工作。

## 接下来去哪

- [快速开始](/zh/guide/getting-started) —— 安装 beam-gpu，在你自己的项目里运行三角形。
- [管线](/zh/guide/pipeline) —— 模式如何驱动类型、顶点布局与绑定组。
- [资源](/zh/guide/resources) —— verts、index、uniforms、textures 与 samplers。
