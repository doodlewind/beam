---
title: 绑定与绘制
---

# 绑定与绘制

WebGPU 按 **组 + 绑定索引（group + binding index）** 来绑定资源，而不是按名称或
顺序。因此 beam-gpu 把一次绘制的数据收进一个带键的对象，这就是 **`Bindings`**，
而且这个对象会针对你所绘制的管线进行泛型类型检查：

```ts
beam.draw(pipe, { verts, index, uniforms, textures, samplers, instances })
```

一条管线、一袋带键的数据、一次绘制。本页将介绍这个袋子里装什么、如何从中构建绑定
组（常规路径与高级路径），以及当场景中有多个对象时你必须遵守的那一条规则。

## Bindings 对象

一个 `Bindings` 对应管线的四套 schema，外加几个绘制时的开关：

```ts
interface Bindings<V, U, T, S> {
  verts: Verts<V>            // 必填：每个顶点属性对应一个缓冲区
  index?: Index             // 可选：索引绘制
  uniforms?: Uniforms<U>    // @group(0) 的 UBO
  textures?: { [K in keyof T]: Texture }  // @group(1) 纹理，按键索引
  samplers?: { [K in keyof S]: Sampler }  // @group(1) 采样器，按键索引
  instances?: number        // 仅绘制数量（默认 1）
  groups?: BindGroup[]       // 高级路径：预先构建好的绑定组
}
```

由于 `draw` 是针对管线泛型的，这些键会替你检查。如果你在管线声明了 `tex2d` 的位置
传入一个 `Texture`、漏掉了必填的 `verts`、或者传入一个 schema 不匹配的
`Uniforms`，那就是一个编译期错误——而不是运行时才暴露的意外。

```ts
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
```

下面就是这段程序的实时运行效果：

<BeamCanvas :setup="hello" />

<script setup>
const wgsl = `
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
`

const hello = ({ beam }) => {
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

::: tip 不使用索引时
`index` 是可选的。省略它，绘制就直接使用 `verts.count` 个顶点，做一次非索引绘制。
带上它，绘制就使用 `index.count` 个索引去引用顶点缓冲区——以此复用共享的顶点。
:::

## 加入纹理和采样器

纹理和采样器是两个独立的键，因为在 WGSL 中它们是 `@group(1)` 下两个独立的绑定
（DESIGN §4）。管线按键声明它们；`Bindings` 在每个键下提供对应的 `Texture` /
`Sampler` 资源：

```ts
const box = beam.pipeline({
  wgsl: boxWgsl,
  vertex: { position: 'vec3', texCoord: 'vec2' },
  uniforms: { mvp: 'mat4' },
  textures: { img: 'tex2d' },
  samplers: { samp: 'sampler' }
})

const tex = beam.texture(image)
const samp = beam.sampler({ wrap: 'repeat', min: 'linear', mag: 'linear' })

beam.frame(() => {
  beam.clear().draw(box, {
    verts,
    index,
    uniforms,
    textures: { img: tex },
    samplers: { samp }
  })
})
```

这些键（`img`、`samp`）与管线 schema 一一对应，TypeScript 会强制执行这一点。
`@group(1)` 内部的绑定**索引**——先按键顺序排纹理，再排采样器——会替你推导出来；
你永远不需要手动去数。

## 绑定组从何而来

一次 WebGPU 绘制需要在 `draw` 之前把 `GPUBindGroup` 设置到渲染通道上。beam-gpu
会替你从带键的 `Bindings` 出发，针对由管线 schema 推导出的布局来构建它们。这里有
两条路径。

### 常规路径——自动且带缓存

你从不需要给绑定组起名字。`draw(pipe, bindings)` 会收集你传入的 `uniforms`、
`textures` 和 `samplers`，构建绑定组，并**按资源标识进行缓存**（DESIGN §3.4）。
每帧都用相同的资源调用 `draw`，这些组只会创建一次然后被复用。用 `.set(...)` 修改
某个资源的内容会保留同一个缓冲区和同一个缓存组——只有分配一个*新*资源才会创建新组。

这是你几乎在任何地方都会用到的路径。上面的 hello-world 从头到尾都没提过
“绑定组”这个词。

### 高级路径——`beam.bind` 与 `pipe.group`

有时你需要一个可复用、显式命名的绑定组——比如让多条管线共享同一个装着相机 uniform
的 `@group(0)`，或者手动设置某个组。`pipe.group(i)` 会给你组 `i` 的带类型
`BindLayout`；`beam.bind(layout, entries)` 会构建一个按绑定索引为键的 `BindGroup`；
然后你通过 `bindings.groups` 把它传进去：

```ts
const camLayout = pipe.group(0)
const camGroup = beam.bind(camLayout, { 0: cameraUniforms })

beam.frame(() => {
  beam.clear().draw(pipe, { verts, index, groups: [camGroup] })
})
```

`beam.bind` 的 entries 以原始绑定索引（`0`、`1`……）为键，既接受 beam 资源，也
接受原始的 WebGPU 对象（`GPUBuffer`、`GPUTextureView`、`GPUSampler`）——它是
那个“下沉一层”的逃生舱口。你通过 `bindings.groups` 提供的组具有优先权；任何你没
提供的部分仍然会从带键字段自动构建。只有当常规路径无法表达你的需求时，才动用它。

## 多对象规则（请读两遍）

这是 WebGPU 模型唯一会咬你一口的地方，也是本页最重要的内容。

**每个对象一个 `uniforms` 资源。**（DESIGN §3.3）

原因如下。单个 `frame` 内的每次绘制都会被记录进同一个命令编码器，并**一起**提交。
更新一个 `Uniforms` 资源会调用 `queue.writeBuffer`——而一帧中所有的 `writeBuffer`
调用都会在任何已记录的绘制在 GPU 上执行*之前*落地。所以如果你在多次绘制间共享同一个
UBO 并在它们之间修改它，每次绘制读到的都是**最后**写入的值，而不是你记录它时所设的值。

这就是陷阱——**千万不要**这样做：

```ts
// 错误：所有小球都渲染在最后一个位置上。
const model = beam.uniforms(pipe.schema.uniforms)

beam.frame(() => {
  beam.clear()
  for (const ball of balls) {
    model.set('modelMat', ball.matrix)   // 覆盖了共享的缓冲区
    beam.draw(pipe, { verts, index, uniforms: model })
  }
})
```

十次绘制全部被记录下来，然后十次 `writeBuffer` 全部落地，接着 GPU 才执行这些绘制
——每一次读到的都是最终的 `ball.matrix`。于是你会得到十个小球叠在同一处。

修复办法是给每个对象**它自己的** `uniforms` 资源，提前一次性分配好：

```ts
// 正确：每个对象一个 uniforms 资源。
const objects = balls.map(ball => ({
  ball,
  uniforms: beam.uniforms(pipe.schema.uniforms, { modelMat: ball.matrix })
}))

beam.frame(() => {
  beam.clear()
  for (const { uniforms } of objects) {
    beam.draw(pipe, { verts, index, uniforms })
  }
})
```

不同的资源意味着不同的缓冲区、不同的缓存绑定组，因而每次绘制有不同的值——这正是你
想要的。要做动画，就用 `.set(...)` 去修改每个对象自己的资源（开销很低，原地修改）；
只要保持它们彼此独立即可。

::: warning 为什么会这样
WebGPU 会把整帧批处理：所有 `writeBuffer` 调用都在已记录的绘制执行之前落地，于是
逐对象的数据就需要逐对象的资源。这不是 Beam 强加的繁文缛节——它就是 WebGPU 实际的
执行方式，值得尽早内化于心。
:::

共享的、整帧恒定的数据——相机的视图/投影矩阵、一个全局光源——应该放进它**自己的**
`uniforms` 资源里，每帧设置一次，在每次绘制中复用。只有那些*逐对象*不同的数据才需要
逐对象。一种常见的结构是：在 `@group(0)` 放一个相机 UBO，外加一个小巧的逐对象模型
UBO。

## 小结

- 一次绘制就是 `beam.draw(pipe, bindings)`——一个带键的 `Bindings`，针对管线做
  类型检查。
- `verts` 是必填的；`index`、`uniforms`、`textures`、`samplers`、`instances`
  和 `groups` 都是可选的。
- 绑定组会自动构建并按资源标识缓存。只有当你需要一个命名、可复用的组时，才下沉到
  `pipe.group(i)` + `beam.bind(...)` + `bindings.groups`。
- **每个对象一个 `uniforms` 资源。** 逐对象的值需要逐对象的资源；只共享整帧恒定的
  uniform。

下一步：[Targets](/zh/guide/targets) 讲离屏渲染，然后是
[Frame & Loop](/zh/guide/frame-and-loop) 讲动画。
