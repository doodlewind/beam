---
title: 设备（Device）
---

# 设备（Device）

Beam 中的一切都从**设备（device）**开始。设备把一个 `GPUAdapter`、一个
`GPUDevice` 以及画布的呈现上下文封装成单一句柄——你用它来创建管线和资源，也用它来
绘制。

创建设备是**异步的**：在 WebGPU 中，获取适配器和获取设备都是 promise。Beam 把整个握手
流程——请求适配器、请求设备、读取首选格式、配置画布——折叠进单个 `await`。

```ts
import { Beam } from 'beam-gpu'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)
```

就是这样。`beam` 已经可以创建 `pipeline`、分配 `verts`/`uniforms`/纹理，
并运行 `frame`。如果你更喜欢那个名字，`Beam.create` 是它的完全等价别名。

## 一个实时的设备

下面是一个真实的设备，正在驱动 hello-world 三角形。画布、`await
Beam.gpu(canvas)` 以及绘制循环全部运行在你的浏览器中：

<BeamCanvas :setup="setup" />

<script setup>
const wgsl = `
struct Uniforms { tint : vec4f, };
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

（`<BeamCanvas>` 组件已经替你完成了 `await Beam.gpu(canvas)`，并把实时的 `beam`
交给你的 `setup`。在普通应用中，你需要像上面的代码片段那样自己编写 `Beam.gpu`
调用。）

## 配置选项

`Beam.gpu(canvas, config?)` 接受一个可选的配置对象。每个字段都是可选的，并且都有
合理的默认值，所以大多数应用什么都不用传。

```ts
const beam = await Beam.gpu(canvas, {
  format: 'rgba8unorm',          // 交换链格式；默认为首选格式
  alpha: 'premultiplied',        // 'opaque'（默认）或 'premultiplied'
  depth: true,                   // 为屏幕通道分配深度缓冲
  hidpi: true,                   // 按 devicePixelRatio 缩放绘制缓冲
  power: 'high-performance',     // 适配器性能偏好
  features: ['float32-filterable'],
  limits: { maxColorAttachments: 8 },
  device: existingDevice         // 复用你已经拥有的设备
})
```

| 选项       | 类型                          | 默认值                                   | 作用                                                                       |
|------------|-------------------------------|------------------------------------------|---------------------------------------------------------------------------|
| `format`   | `GPUTextureFormat`            | `getPreferredCanvasFormat()`             | 交换链颜色格式。除非有特殊理由，否则不要设置它。                            |
| `alpha`    | `'opaque' \| 'premultiplied'` | `'opaque'`                               | 画布如何与页面合成。在 HTML 之上做混合时使用 `'premultiplied'`。            |
| `depth`    | `boolean`                     | `false`                                  | 为默认屏幕通道分配深度纹理（3D 所需）。                                     |
| `hidpi`    | `boolean`                     | `false`                                  | 将绘制缓冲尺寸乘以 `devicePixelRatio`，以获得清晰的 Retina 输出。           |
| `power`    | `GPUPowerPreference`          | 适配器默认值                             | 适配器选择时的 `'high-performance'` 或 `'low-power'` 提示。                 |
| `features` | `GPUFeatureName[]`            | 无                                       | 要请求的可选设备特性（例如 `'float32-filterable'`）。                       |
| `limits`   | `Record<string, number>`      | 适配器默认值                             | 在设备上提高特定的 `requiredLimits`。                                       |
| `device`   | `GPUDevice`                   | 新请求的设备                             | 跳过适配器/设备握手，直接采用你已经创建好的设备。                          |

有几点值得记住：

- **`depth` 默认关闭。** hello-world 三角形是 2D 的，不需要深度。一旦你开始绘制 3D
  几何体就立刻打开它——此时每个管线的 `depth: true` 和这个设备的
  `depth: true` 会协同工作。
- **`hidpi` 需要主动开启。** 默认情况下，绘制缓冲的尺寸正好等于你在画布上设置的尺寸。
  开启 `hidpi: true` 后，`Beam.gpu` 以及后续的 `beam.resize()` 会乘以
  `devicePixelRatio`，因此在 2× 显示屏上，一个 400×400 的 CSS 画布会分配 800×800 像素。
- **`features` 和 `limits` 必须被适配器支持。** 只请求你会用到的东西；请求不被支持的
  特性会导致设备请求被拒绝（参见下文的错误处理）。
- **`device`** 让应用的两个部分共享同一个 `GPUDevice`。Beam 会针对它来配置
  画布，而不是重新请求一个新的。

## 逃生舱口（Escape hatches）

Beam 从不隐藏真实的 WebGPU 对象。设备暴露了五个只读句柄，所以你随时都可以下沉一层，
而无需重新获取任何东西：

```ts
beam.device   // GPUDevice —— 创建原始缓冲、计算管线、查询集……
beam.adapter  // GPUAdapter —— 检查特性、限制、信息
beam.ctx      // GPUCanvasContext —— getCurrentTexture()、reconfigure()
beam.format   // 交换链所配置使用的 GPUTextureFormat
beam.canvas   // 你传入的 HTMLCanvasElement
```

这就是设计上的承诺：每个 Beam 动词都映射到一次真实的 WebGPU 调用，每个句柄都暴露其
原始对象。需要某个 Beam 简洁接口未覆盖的特性——计算通道、存储缓冲、间接绘制？通过
`beam.device` 伸手过去，编写纯粹的 WebGPU 即可；Beam 创建的资源
（`verts.buffers`、`uniforms.buffer`、`texture.gpu`）全都是真实的 GPU 对象，你可以
混合使用它们。

```ts
// 例如：手动构建原始管线时读取已配置的格式
const myPipeline = beam.device.createRenderPipeline({
  // ...
  fragment: { module, entryPoint: 'fs', targets: [{ format: beam.format }] }
})
```

## 初始化时的错误处理

`Beam.gpu` 可能因两种截然不同的原因失败，而它们需要不同的处理方式。

**1. WebGPU 不可用。** 在不支持 WebGPU 的浏览器上，`navigator.gpu` 是 `undefined`，
也无法获取任何适配器。先检查它，并展示一个友好的降级提示，而不是把异常抛向一块空白
画布：

```ts
if (!navigator.gpu) {
  showMessage('WebGPU is not available — try the latest Chrome, Edge, or Safari.')
} else {
  const beam = await Beam.gpu(canvas)
  // … render …
}
```

**2. 请求被拒绝。** 即便 WebGPU 存在，适配器或设备请求仍可能被拒绝——最常见的情形是
你请求了适配器无法提供的 `feature` 或 `limit`。`Beam.gpu` 返回一个 promise，所以用
`try/catch` 包裹这个 `await`：

```ts
try {
  const beam = await Beam.gpu(canvas, {
    features: ['float32-filterable']
  })
  // … render …
} catch (err) {
  console.error('Beam init failed:', err)
  showMessage('Could not initialize the GPU. ' + err.message)
}
```

健壮的启动流程会结合这两种检查：当 `navigator.gpu` 缺失时尽早退出，然后用
`try/catch` 包裹 `await` 来处理其他一切。（这正是上面那个实时的
`<BeamCanvas>` 所做的——它守护 `navigator.gpu`、捕获设置错误，并渲染一条
得体的提示信息，而不是一块死掉的画布。）

## 调整尺寸

当画布尺寸发生变化时，调用 `resize`。不带参数时，它会重新读取画布当前的尺寸
（如果启用了 `hidpi`，也会重新应用它）；传入明确的像素值则用来设置尺寸：

```ts
beam.resize()              // 重新读取 canvas.width/height，重新配置交换链 + 深度
beam.resize(1280, 720)     // 设置明确的绘制缓冲尺寸
```

`resize` 会重新配置交换链，并重新分配屏幕深度缓冲（如果启用了 `depth`），所以请在
画布的 CSS 盒子发生变化后调用它——通常来自 `ResizeObserver` 或 `window` 的 resize
处理函数。

## 清理

当你用完一个设备时——卸载组件、拆除演示——调用 `destroy()` 来释放 `GPUDevice`
以及 Beam 为屏幕通道创建的资源：

```ts
beam.destroy()
```

---

下一步：把这个设备变成实际的绘制。继续阅读 [管线（Pipelines）](/zh/guide/pipeline)，
了解 `beam.pipeline(template)` 如何从 WGSL 加上 schema 构建出一个
`GPURenderPipeline`。
