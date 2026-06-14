---
title: The Device
---

# The Device

Everything in Beam starts from a **device**. The device wraps a `GPUAdapter`, a
`GPUDevice`, and the canvas's presentation context into one handle — the thing you
make pipelines and resources from, and the thing you draw with.

Unlike the old WebGL `new Beam(canvas)`, creating a device is **asynchronous**:
acquiring an adapter and a device are both promises in WebGPU. Beam folds the whole
handshake — request adapter, request device, read the preferred format, configure the
canvas — into a single `await`.

```ts
import { Beam } from 'beam-gpu'

const canvas = document.querySelector('canvas')!
canvas.width = 400
canvas.height = 400

const beam = await Beam.gpu(canvas)
```

That's it. `beam` is ready to make a `pipeline`, allocate `verts`/`uniforms`/textures,
and run a `frame`. `Beam.create` is an exact alias if you prefer that name.

## A live device

Here is a real device driving the hello-world triangle. The canvas, the `await
Beam.gpu(canvas)`, and the draw loop all run in your browser:

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

(The `<BeamCanvas>` component already does `await Beam.gpu(canvas)` for you and hands
your `setup` the live `beam`. In a normal app you write the `Beam.gpu` call yourself,
as in the snippet above.)

## Config options

`Beam.gpu(canvas, config?)` takes an optional config object. Every field is optional and
has a sensible default, so most apps pass nothing.

```ts
const beam = await Beam.gpu(canvas, {
  format: 'rgba8unorm',          // swapchain format; defaults to the preferred format
  alpha: 'premultiplied',        // 'opaque' (default) or 'premultiplied'
  depth: true,                   // allocate a depth buffer for the screen pass
  hidpi: true,                   // scale the drawing buffer by devicePixelRatio
  power: 'high-performance',     // adapter power preference
  features: ['float32-filterable'],
  limits: { maxColorAttachments: 8 },
  device: existingDevice         // reuse a device you already own
})
```

| Option     | Type                          | Default                                  | What it does                                                              |
|------------|-------------------------------|------------------------------------------|---------------------------------------------------------------------------|
| `format`   | `GPUTextureFormat`            | `getPreferredCanvasFormat()`             | The swapchain color format. Leave it unset unless you have a reason.       |
| `alpha`    | `'opaque' \| 'premultiplied'` | `'opaque'`                               | How the canvas composites with the page. Use `'premultiplied'` for blending over HTML. |
| `depth`    | `boolean`                     | `false`                                  | Allocate a depth texture for the default screen pass (needed for 3D).     |
| `hidpi`    | `boolean`                     | `false`                                  | Multiply the drawing-buffer size by `devicePixelRatio` for crisp Retina output. |
| `power`    | `GPUPowerPreference`          | adapter default                          | `'high-performance'` or `'low-power'` hint for adapter selection.         |
| `features` | `GPUFeatureName[]`            | none                                     | Optional device features to request (e.g. `'float32-filterable'`).        |
| `limits`   | `Record<string, number>`      | adapter defaults                         | Raise specific `requiredLimits` on the device.                            |
| `device`   | `GPUDevice`                   | freshly requested                        | Skip the adapter/device handshake and adopt a device you already created. |

A few notes worth remembering:

- **`depth` is off by default.** The hello-world triangle is 2D and needs no depth. Turn
  it on the moment you draw 3D geometry — then per-pipeline `depth: true` and this device
  `depth: true` work together.
- **`hidpi` is opt-in.** By default the drawing buffer is exactly the size you set on the
  canvas. With `hidpi: true`, `Beam.gpu` and later `beam.resize()` multiply by
  `devicePixelRatio`, so a 400×400 CSS canvas allocates 800×800 pixels on a 2× display.
- **`features` and `limits` must be supported by the adapter.** Request only what you use;
  asking for an unsupported feature rejects the device request (see error handling below).
- **`device`** lets two parts of an app share one `GPUDevice`. Beam will configure the
  canvas against it instead of requesting a new one.

## Escape hatches

Beam never hides the real WebGPU objects. The device exposes five read-only handles, so
you can always drop one level down without re-acquiring anything:

```ts
beam.device   // the GPUDevice — make raw buffers, compute pipelines, query sets…
beam.adapter  // the GPUAdapter — inspect features, limits, info
beam.ctx      // the GPUCanvasContext — getCurrentTexture(), reconfigure()
beam.format   // the GPUTextureFormat the swapchain was configured with
beam.canvas   // the HTMLCanvasElement you passed in
```

This is the design promise: every Beam verb maps to a real WebGPU call, and every handle
exposes its raw object. Need a feature Beam's terse surface doesn't cover — a compute
pass, a storage buffer, an indirect draw? Reach through `beam.device` and write plain
WebGPU; the resources Beam made (`verts.buffers`, `uniforms.buffer`, `texture.gpu`) are
all real GPU objects you can mix in.

```ts
// e.g. read the configured format when building a raw pipeline by hand
const myPipeline = beam.device.createRenderPipeline({
  // ...
  fragment: { module, entryPoint: 'fs', targets: [{ format: beam.format }] }
})
```

## Error handling on init

`Beam.gpu` can fail for two distinct reasons, and they want different handling.

**1. WebGPU is unavailable.** On a browser without WebGPU, `navigator.gpu` is `undefined`
and no adapter can be acquired. Check first and show a friendly fallback rather than
throwing into a blank canvas:

```ts
if (!navigator.gpu) {
  showMessage('WebGPU is not available — try the latest Chrome, Edge, or Safari.')
} else {
  const beam = await Beam.gpu(canvas)
  // … render …
}
```

**2. The request rejects.** Even with WebGPU present, the adapter or device request can
reject — most commonly when you ask for a `feature` or `limit` the adapter can't provide.
`Beam.gpu` returns a promise, so wrap the `await` in `try/catch`:

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

A robust startup combines both checks: bail early when `navigator.gpu` is missing, then
`try/catch` the `await` for everything else. (This is exactly what the live
`<BeamCanvas>` above does — it guards `navigator.gpu`, catches setup errors, and renders
a graceful message instead of a dead canvas.)

## Resizing

When the canvas changes size, call `resize`. With no arguments it re-reads the canvas's
current dimensions (and reapplies `hidpi` if enabled); pass explicit pixels to set them:

```ts
beam.resize()              // re-read canvas.width/height, reconfigure swapchain + depth
beam.resize(1280, 720)     // set an explicit drawing-buffer size
```

`resize` reconfigures the swapchain and reallocates the screen depth buffer (if `depth`
was enabled), so call it after the canvas's CSS box changes — typically from a
`ResizeObserver` or a `window` resize handler.

## Cleanup

When you're done with a device — unmounting a component, tearing down a demo — call
`destroy()` to release the `GPUDevice` and the resources Beam created for the screen
pass:

```ts
beam.destroy()
```

---

Next: turn this device into draws. Continue to [Pipelines](/guide/pipeline) to learn how
`beam.pipeline(template)` builds a `GPURenderPipeline` from WGSL plus schemas.
