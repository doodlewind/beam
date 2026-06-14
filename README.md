# Beam

**Expressive WebGPU** — a tiny, teachable WebGPU library.

> This is `beam-gpu`, the TypeScript + native-WebGPU rewrite of the original
> [`beam-gl`](https://github.com/doodlewind/beam/tree/master) (Expressive WebGL).
> It keeps Beam's "make data, then draw it" aesthetic while honestly exposing
> WebGPU's real model — every Beam verb maps 1:1 to a real WebGPU call, and every
> handle exposes its raw object.

## What is Beam?

Beam is **not** a renderer or a 3D engine. It's a small, honest wrapper over the
WebGPU API that gives you a terse, schema-driven way to build renderers — with
first-class TypeScript types and hand-authored WGSL shaders that Beam never
rewrites.

The whole surface is **five nouns and two verbs**:

| Noun              | Wraps                                       |
| ----------------- | ------------------------------------------- |
| `Beam` (device)   | `GPUAdapter` + `GPUDevice` + canvas context |
| `Pipeline`        | `GPURenderPipeline` + derived layouts       |
| resources         | persistent `GPUBuffer` / `GPUTexture` / sampler |
| `Bindings`        | the data you hand one draw (→ `GPUBindGroup`)   |
| `Pass` / `Target` | a render pass / render-to-texture attachment    |

…and the verbs `frame(cb)` (open the per-frame encoder, run draws, submit) and
`draw(pipeline, bindings)`.

## Hello, triangle

```ts
import { Beam } from 'beam-gpu'
import wgsl from './hello.wgsl?raw'

const beam = await Beam.gpu(document.querySelector('canvas')!)

const tri = beam.pipeline({
  wgsl,
  vertex: { position: 'vec3', color: 'vec3' },
  uniforms: { tint: 'vec4' },
})

const verts = beam.verts(tri.schema.vertex, {
  position: [-1, -1, 0, 0, 1, 0, 1, -1, 0],
  color: [1, 0, 0, 0, 1, 0, 0, 0, 1],
})
const index = beam.index({ array: [0, 1, 2] })
const uniforms = beam.uniforms(tri.schema.uniforms, { tint: [1, 1, 1, 1] })

beam.frame(() => {
  beam.clear([0, 0, 0, 1]).draw(tri, { verts, index, uniforms })
})
```

See [`DESIGN.md`](./DESIGN.md) for the full design rationale and the
[migration map](./DESIGN.md#5-migration-map-old-beam-gl--beam-gpu) from the old
WebGL API, and [`packages/beam/reference-api.d.ts`](./packages/beam/reference-api.d.ts)
for the complete public type surface.

## Requirements

A WebGPU-capable browser (Chrome/Edge 113+, Safari 18+, recent Firefox).

## This repository (monorepo)

```
packages/beam/   the library (npm: beam-gpu)
examples/        the gallery — every example ported to WGSL/WebGPU (Vite MPA)
docs/            the documentation site (VitePress, English + 简体中文)
DESIGN.md        the locked API design + WebGL→WebGPU migration map
```

### Develop

```bash
pnpm install

pnpm --filter beam-gpu build       # build the library (+ .d.ts)
pnpm --filter beam-gpu test        # unit tests (schema / std140 packing)

pnpm dev                           # run the examples gallery (Vite)
pnpm docs:dev                      # run the docs site (VitePress)
```

## Install

```bash
npm i beam-gpu
```

## License

MIT © Yifeng Wang
