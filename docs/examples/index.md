---
title: Examples
---

# Examples

A gallery of small, self-contained programs that exercise the whole `beam-gpu`
surface — from a first triangle to PBR materials, shadow maps, and a GPU
cellular automaton. Each one is a few dozen lines of TypeScript plus a
hand-authored `.wgsl` module, so you can read any of them top to bottom in a
sitting.

::: tip Run them locally
These examples live in the `examples` workspace. From the repo root, run
`pnpm dev` to start the examples app, then open the linked path in your
browser. Each link below points at the example's folder
(`/play/pages/<category>/<name>/`).
:::

::: warning Requires WebGPU
Every example renders with native WebGPU. You need a WebGPU-capable browser
(recent Chrome, Edge, or Safari) with hardware acceleration enabled. If the
canvas stays blank, check that `navigator.gpu` is available.
:::

## Basic graphics

Start here. These cover the core loop: build a pipeline from WGSL + schemas,
make resources, and draw.

- [Hello world](/play/pages/basic-graphics/hello-world/) — the gold-standard
  starting point. A single triangle from one pipeline, one `verts` resource, and
  one `frame`. Read this first.
- [Image box](/play/pages/basic-graphics/image-box/) — a textured cube under
  a perspective camera, introducing `texture`, `sampler`, and a `mat4` uniform.
- [Basic ball](/play/pages/basic-graphics/basic-ball/) — a normal-shaded
  sphere, showing indexed geometry and a camera matrix.
- [Zooming ball](/play/pages/basic-graphics/zooming-ball/) — animates the
  same ball with `beam.loop`, updating uniforms every frame.
- [Multi-balls](/play/pages/basic-graphics/multi-balls/) — many balls in one
  frame, with one `uniforms` resource per object (DESIGN §3.3).
- [Multi-graphics](/play/pages/basic-graphics/multi-graphics/) — boxes and
  balls drawn together, mixing geometries in a single frame.
- [Wireframe](/play/pages/basic-graphics/wireframe/) — overlays a wireframe
  pass on a shaded mesh using two pipelines.

## Image processing

Full-screen-quad pipelines: every fragment is a pixel, and the fun is in the
shader. A shared unit quad feeds them all.

- [Basic image](/play/pages/image-processing/basic-image/) — fill the canvas
  with a texture on a flat quad, no projection. The simplest texture sample.
- [Single filter](/play/pages/image-processing/single-filter/) — one filter
  with live slider controls writing a named uniform before each redraw.
- [Multi-filters](/play/pages/image-processing/multi-filters/) — three
  single-pass filters sharing one vertex schema, each with its own pipeline.
- [Mix images](/play/pages/image-processing/mix-images/) — blend two
  textures in one shader, reusing a single sampler for both.
- [Load SVG](/play/pages/image-processing/load-svg/) — rasterize an SVG via
  a blob loader and upload it as a texture.
- [Premultiply alpha](/play/pages/image-processing/premultiply-alpha/) —
  composite the canvas over the page background with a premultiplied-alpha
  context and matching shader output.
- [Texture config](/play/pages/image-processing/texture-config/) — explore
  sampler and texture options (wrap, filter, `flipY`), rebuilding the immutable
  sampler on each change.

## 3D models

Lit geometry, normal matrices, and physically based shading.

- [Basic lighting](/play/pages/3d-models/basic-lighting/) — directional
  lighting with interactive controls for model rotation and light
  direction/color/strength.
- [Material ball](/play/pages/3d-models/material-ball/) — a PBR sphere using
  environment maps and a BRDF LUT, with the uniform struct laid out to std140.
- [Material balls](/play/pages/3d-models/material-balls/) — a grid of PBR
  balls sweeping roughness and metalness, one `uniforms` resource per ball.

## Offscreen

Render-to-texture targets: draw into an offscreen `Target`, then sample its
color or depth in a second pass.

- [Basic mesh](/play/pages/offscreen/basic-mesh/) — render a lit mesh into a
  color + depth target, then blit that color onto a full-screen quad.
- [Basic shadow](/play/pages/offscreen/basic-shadow/) — a two-pass shadow
  map: render depth from the light's view, then shade from the camera with a
  comparison sampler.
- [Visualize depth](/play/pages/offscreen/visualize-depth/) — fill an
  offscreen depth buffer, then sample `target.depth` into a grayscale view.

## Effects

Multi-pass and ping-pong techniques.

- [Conway](/play/pages/effects/conway/) — Conway's Game of Life on the GPU,
  ping-ponging state between two targets with a step pipeline and a display
  pipeline.
- [Image explode](/play/pages/effects/image-explode/) — a grid of textured
  quads that explode outward and reassemble, animated by a progress uniform.

## Design patterns

Higher-level structure built on the terse core.

- [Build renderer](/play/pages/design-patterns/build-renderer/) — wrap
  `beam-gpu` in a small `MeshRenderer` / `Mesh` abstraction that owns the device,
  pipelines, and scene, keeping the app code tiny.
