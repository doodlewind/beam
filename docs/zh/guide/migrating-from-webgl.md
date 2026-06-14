---
title: 从 WebGL 迁移
---

# 从 WebGL 迁移

如果你用过最初的 Beam（`beam-gl`），那么你已经掌握了整套心智模型：**先造数据，再画出来。** `beam-gpu` 保留了这种风格，只不过它构建在 WebGPU 而非 WebGL 之上——所以有几个名词被重新命名，GLSL 变成了 WGSL，而 WebGL 隐藏起来的两个概念（命令编码器和绑定组）变得可见了。

本页是一份对照翻译指南。每一个旧动词几乎都能 1:1 映射到一个新动词。从头读到尾，你的旧渲染器就能机械式地移植过来。

## 两处概念上的转变

在逐行对照之前，有两个概念改变了形态。它们是你唯一需要*重新学习*的东西；其余的一切都只是改名而已。

### 1. 状态机 → 逐帧编码器

WebGL 是一个全局状态机：你设置状态（`gl.useProgram`、`gl.bindBuffer`、`gl.uniformMatrix4fv`），然后 `gl.drawElements` 会读取当前绑定的任何内容。旧版 Beam 把这些都藏在了 `beam.clear().draw(...)` 背后——每次调用都会修改 GL 状态并立即发出绘制命令。

WebGPU 把命令记录进一个**命令编码器**，然后一次性提交它们。`beam-gpu` 保持了这种诚实，但去掉了繁文缛节：你把绘制包裹在 `beam.frame(cb)`（或 `beam.loop(cb)`）里。在回调内部，`clear` 和 `draw` 会记录进该帧的编码器；当回调返回时，Beam 完成编码并提交。

```ts
// 旧版 beam-gl：每次绘制立即执行
beam.clear().draw(shader, verts, index, uniforms)

// beam-gpu：绘制在一帧内被记录，然后一起提交
beam.frame(() => {
  beam.clear().draw(pipe, { verts, index, uniforms })
})
```

这带来一个实际后果：因为一帧中的每次绘制都会一起提交，你所有的 `uniforms.set(...)` 写入都会在任何绘制运行*之前*落地。共享同一个 `uniforms` 资源的连续绘制会全部读到**最后**写入的值。所以一个多物体场景要为每个物体分配一个 `uniforms` 资源——参见 [帧与循环](/zh/guide/frame-and-loop)。在旧版 Beam 里，你可以靠一个 `camera` uniform 并在绘制之间调用 `camera.set('modelMat', ...)` 蒙混过关；但在 WebGPU 下这种写法不再正确。

### 2. 按名绑定 → 绑定组

在 WebGL 中，一个 uniform 或采样器是通过**名字**来查找的：`gl.getUniformLocation(prog, 'modelMat')`。旧版 Beam 依赖于此——你着色器里的键 `modelMat` 匹配你资源里的键 `modelMat`，再由一个位置参数 `...resources` 展开把它们填进去。

WebGPU 是按**组 + 绑定索引**绑定的，而不是按名字。因此 `beam-gpu` 用单个带键的 `bindings` 对象替换了位置展开，而这些*位置*则由你的管线 schema 推导得出：

```ts
// 旧版 beam-gl：位置展开，按着色器键名匹配
beam.draw(shader, vertexBuffers, indexBuffer, uniforms, textures)

// beam-gpu：单个带键对象，按管线做类型检查
beam.draw(pipe, { verts, index, uniforms, textures, samplers })
```

你几乎从不需要给绑定组命名：`draw` 会根据带键的 `bindings` 替你构建并缓存它们。决定每样东西落在哪个组/绑定的约定是固定且简短的——参见 [WGSL 约定](/zh/guide/wgsl-conventions)。

## 迁移对照表

下面是完整的旧 → 新对照表。后续小节会展开其中有意思的行。

| 旧版 Beam（`beam-gl`）                           | `beam-gpu` 等价写法                                              |
|-------------------------------------------------|------------------------------------------------------------------|
| `new Beam(canvas, config)`                      | `await Beam.gpu(canvas, config)`（别名 `Beam.create`）——异步     |
| `beam.gl`                                       | `beam.device`（外加 `beam.adapter`、`beam.ctx`、`beam.format`）  |
| `beam.shader(template)`                         | `beam.pipeline(template)` → `Pipeline<V, U, T, S>`               |
| 模板 `{ vs, fs }`（GLSL）                       | 模板 `{ wgsl }`（单个 WGSL 模块）；`vsEntry` / `fsEntry`         |
| 模板 `buffers` schema                           | 模板 `vertex` schema（键 → `@location` 顺序）                    |
| 模板 `uniforms` schema                          | 模板 `uniforms` schema（位于 `@group(0)` 的单个 std140 UBO）     |
| 模板 `textures` schema                          | 模板 `textures` + `samplers` schema（→ `@group(1)`）            |
| 模板 `mode`                                     | 模板 `primitive: 'tri' \| 'tri-strip' \| 'line' \| 'point'`     |
| 模板 `defines`                                  | 模板 `constants`（WGSL override 常量）                          |
| `beam.resource(VertexBuffers, state)`           | `beam.verts(schema, state)` → `Verts<V>`                         |
| `beam.resource(IndexBuffer, { array })`         | `beam.index({ array, offset?, count? })` → `Index`               |
| `beam.resource(Uniforms, state)`               | `beam.uniforms(schema, state)` → `Uniforms<U>`（单个 UBO）       |
| `beam.resource(Textures, state)`                | `beam.texture(src, opts)` / `beam.cube(faces, opts)` + sampler   |
| `resource.set(key, val)`                        | `resource.set(key, val)` / `.set(obj)`——同样的链式模型           |
| `ResourceTypes` 枚举                            | 已移除（改用具名工厂——WebGPU 没有这种枚举）                      |
| `SchemaTypes.vec3` 等                           | 字符串字面量 `'vec3' \| 'mat4' \| 'f32' \| ...`                  |
| `SchemaTypes.tex2D` / `texCube`                 | `'tex2d'` + `beam.texture` / `'texCube'` + `beam.cube`           |
| `beam.clear([r,g,b,a])`                         | `beam.clear([r,g,b,a], depth?)`——可链式                         |
| `beam.draw(shader, vbuf, ibuf, uniforms, tex)`  | `beam.draw(pipe, { verts, index, uniforms, textures, samplers })`|
| `beam.target(w, h, depth)`                      | `beam.target({ width, height, depth?, format?, samples? })`      |
| `target.use(cb)`                                | `target.clear().draw(pipe, bindings)`——与 `beam` 相同的链式      |
| `target.texture`                                | `target.color`（Texture）和 `target.depth`（可采样的深度）       |
| `textures.set('img', target.texture)`           | `bindings.textures = { img: target.color }`                      |
| 手写 `requestAnimationFrame` 循环               | `beam.loop((t, dt) => {...})` → `stop()`；或 `beam.frame((t) => {...})` |
| 隐式的 GL 状态机                                | `frame` / `loop` 内部隐式的逐帧编码器                            |

## Shader → Pipeline

`beam.shader` 变成了 `beam.pipeline`。schema 几乎一模一样——`buffers` 变成 `vertex`，schema 类型变成字符串字面量，而两段 GLSL 字符串合并成了带有 `vs` 和 `fs` 入口点的单个 WGSL 模块。

```js
// 旧版 beam-gl —— 两段 GLSL 字符串 + 一个 schema 对象
import { SchemaTypes } from 'beam-gl'
const { vec3, vec4 } = SchemaTypes

const vs = `
attribute vec4 position;
attribute vec4 color;
varying highp vec4 vColor;
void main() {
  vColor = color;
  gl_Position = position;
}
`
const fs = `
varying highp vec4 vColor;
void main() { gl_FragColor = vColor; }
`

const shader = beam.shader({
  vs,
  fs,
  buffers: {
    position: { type: vec4, n: 3 },
    color: { type: vec4, n: 3 }
  }
})
```

```ts
// beam-gpu —— 单个 WGSL 模块 + 一个带类型的 schema
import wgsl from './hello.wgsl?raw'

const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' }
})
```

### GLSL → WGSL

着色器语言也变了。WGSL 更加显式，但这些转换都是机械式的：

| GLSL                                  | WGSL                                            |
|---------------------------------------|-------------------------------------------------|
| `attribute vec4 position;`            | `@location(0) position : vec3f`（一个 `vs` 参数）|
| `varying vec4 vColor;`                | 返回 `struct`（如 `VsOut`）上的一个字段          |
| `uniform mat4 modelMat;`              | 位于 `@group(0) @binding(0)` 的 `struct` 的一个字段 |
| `gl_Position = ...`                   | `out.pos = ...`，其中 `out.pos` 是 `@builtin(position)` |
| `gl_FragColor = ...`                  | 从 `@fragment fn -> @location(0) vec4f` 中 `return ...` |
| `texture2D(img, uv)`                  | `textureSample(img, samp, uv)`（显式采样器）     |

下面是 hello-world 里的彩色三角形模块，它遵循固定的 [WGSL 约定](/zh/guide/wgsl-conventions)——先是 uniforms 结构体，然后是绑定，接着是 `@vertex`，最后是 `@fragment`：

```wgsl
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

注意在 WebGPU 中，采样器是与纹理*分离*的绑定。单个 GLSL 的 `sampler2D img` 会拆成一个 WGSL 的 `texture_2d<f32>` 加上一个 `sampler`，这就是为什么管线 schema 在 `textures` 旁边多出了一个 `samplers` 字段。

## Resources → verts / index / uniforms / texture

`beam.resource(Type, state)` 工厂及其 `ResourceTypes` 枚举已经没有了。取而代之，每种资源类型都有自己的具名工厂。`.set(...)` 的修改模型保持不变——同样的链式调用，嵌套结构体也用同样的点分键。

```js
// 旧版 beam-gl
import { ResourceTypes } from 'beam-gl'
const { VertexBuffers, IndexBuffer, Uniforms, Textures } = ResourceTypes

const verts = beam.resource(VertexBuffers, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.resource(IndexBuffer, { array: [0, 1, 2] })
const camera = beam.resource(Uniforms, cameraMats)
const textures = beam.resource(Textures, { img: imageState })
```

```ts
// beam-gpu —— 具名工厂；schema 来自管线
const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1]
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })

const img = beam.texture(image)
const samp = beam.sampler({ wrap: 'clamp', min: 'linear', mag: 'linear' })
```

有两点值得注意：

- **纹理和采样器是分开的。** 旧版 Beam 的 `Textures` 资源同时承载图像及其过滤/包裹方式。在 `beam-gpu` 中，`beam.texture(...)` 是图像，而 `beam.sampler(...)` 是过滤方式——它们各自分别绑定进 `@group(1)`。采样器是不可变的；要改变过滤方式，就新建一个。
- **每个 `uniforms` 资源对应一个 UBO。** 一个 `uniforms` 资源就是单个 std140 UBO。对于多物体场景，要为每个物体分配一个 `uniforms`，而不是在绘制之间修改一个共享的（参见上文的编码器转变）。

## Clear 与 draw

`clear` 在精神上没有改变——它设置下一个 pass 的载入颜色，并返回 `this` 以便你链式调用 `draw`。`draw` 的签名才是带键的 bindings 对象取代位置展开之处。

```js
// 旧版 beam-gl —— 位置参数，立即执行
beam
  .clear([0, 0, 0, 1])
  .draw(shader, verts, index, uniforms)
```

```ts
// beam-gpu —— 带键的 bindings，在一帧内被记录
beam.frame(() => {
  beam
    .clear([0, 0, 0, 1])
    .draw(tri, { verts, index, uniforms })
})
```

这些键（`verts`、`index`、`uniforms`、`textures`、`samplers`、`instances`）会针对管线 `tri` 做类型检查，因此缺失或类型错误的资源会变成一个编译错误，而不是悄无声息的一片空白屏幕。

### 一个实时的三角形

下面是整个东西的运行效果。`BeamCanvas` 宿主已经替你完成了 `await Beam.gpu(canvas)`，并传入 `{ beam, canvas }`：

<BeamCanvas :setup="({ beam }) => {
  const wgsl = `
    struct Uniforms { tint : vec4f, };
    @group(0) @binding(0) var<uniform> u : Uniforms;
    struct VsOut {
      @builtin(position) pos : vec4f,
      @location(0) color : vec3f,
    };
    @vertex fn vs(
      @location(0) position : vec3f,
      @location(1) color : vec3f,
    ) -> VsOut {
      var out : VsOut;
      out.pos = vec4f(position, 1.0);
      out.color = color;
      return out;
    }
    @fragment fn fs(in : VsOut) -> @location(0) vec4f {
      return vec4f(in.color, 1.0) * u.tint;
    }
  `
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

## 离屏目标（Offscreen target）

旧版 Beam 的 `beam.target(w, h, depth)` 加上 `target.use(cb)`，变成了一个*自己就能绘制*的 `Target` 对象——和 `beam` 一样的 `clear().draw(...)` 链式调用，所以不再有单独的 `use` 作用域需要嵌套。

```js
// 旧版 beam-gl —— 在 target.use 里嵌套绘制，然后读取 target.texture
const target = beam.target(2048, 2048)
target.use(() => {
  beam.draw(shaderX, ...resourcesA)
})
myTextures.set('img', target.texture)
```

```ts
// beam-gpu —— target 自己绘制；读取 target.color
const target = beam.target({ width: 2048, height: 2048, depth: true })

beam.frame(() => {
  // 把场景绘制进离屏的颜色纹理
  target.clear().draw(pipeX, bindingsA)

  // 然后在屏幕 pass 中采样 target.color
  beam.draw(post, {
    verts,
    index,
    textures: { img: target.color },
    samplers: { samp }
  })
})
```

旧版的 `target.texture` 现在是 `target.color`（一个可采样的 `Texture`），而带深度的 target 还额外暴露一个可采样的 `target.depth`——这对阴影映射很方便，你可以绑定 `{ shadowMap: target.depth }`。

## 动画：rAF → loop

你不再需要手写 `requestAnimationFrame` 循环了。`beam.loop(cb)` 会替你运行一个，并返回一个 `stop()` 函数；回调会接收到经过的时间 `t` 和增量 `dt`（都以秒为单位）。每一帧（tick）都已经被包裹在一个 frame 里，所以你只管 `clear` 和 `draw`。

```js
// 旧版 beam-gl —— 手动 rAF，在绘制之间手动修改
const tick = () => {
  i += 0.02
  camera.set('viewMat', createCamera({ eye: [0, d, d] }).viewMat)
  beam.clear().draw(shader, ...buffers, camera)
  requestAnimationFrame(tick)
}
tick()
```

```ts
// beam-gpu —— beam.loop 拥有该帧；返回 stop()
const stop = beam.loop((t) => {
  uniforms.set('viewMat', createCamera({ eye: [0, d, d] }).viewMat)
  beam.clear().draw(pipe, { verts, index, uniforms })
})

// 稍后：stop()
```

## 接下来去哪

- [Pipeline](/zh/guide/pipeline) —— 完整的模板、预设，以及 schema → 布局规则。
- [Resources](/zh/guide/resources) —— 深入了解 verts、index、uniforms、textures、samplers。
- [Bindings & draw](/zh/guide/bindings-and-draw) —— 带键的 bindings 对象与绑定组。
- [Frame & loop](/zh/guide/frame-and-loop) —— 为什么每个物体要一个 UBO，以及编码器模型。
- [WGSL conventions](/zh/guide/wgsl-conventions) —— 固定的 `@location` / `@group` 规则。
