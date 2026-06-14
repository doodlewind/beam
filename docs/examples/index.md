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

- <PlayLink to="basic-graphics/hello-world">Hello world</PlayLink> — the gold-standard
  starting point. A single triangle from one pipeline, one `verts` resource, and
  one `frame`. Read this first.
- <PlayLink to="basic-graphics/image-box">Image box</PlayLink> — a textured cube under
  a perspective camera, introducing `texture`, `sampler`, and a `mat4` uniform.
- <PlayLink to="basic-graphics/basic-ball">Basic ball</PlayLink> — a normal-shaded
  sphere, showing indexed geometry and a camera matrix.
- <PlayLink to="basic-graphics/zooming-ball">Zooming ball</PlayLink> — animates the
  same ball with `beam.loop`, updating uniforms every frame.
- <PlayLink to="basic-graphics/multi-balls">Multi-balls</PlayLink> — many balls in one
  frame, with one `uniforms` resource per object (DESIGN §3.3).
- <PlayLink to="basic-graphics/multi-graphics">Multi-graphics</PlayLink> — boxes and
  balls drawn together, mixing geometries in a single frame.
- <PlayLink to="basic-graphics/wireframe">Wireframe</PlayLink> — overlays a wireframe
  pass on a shaded mesh using two pipelines.

## Image processing

Full-screen-quad pipelines: every fragment is a pixel, and the fun is in the
shader. A shared unit quad feeds them all.

- <PlayLink to="image-processing/basic-image">Basic image</PlayLink> — fill the canvas
  with a texture on a flat quad, no projection. The simplest texture sample.
- <PlayLink to="image-processing/single-filter">Single filter</PlayLink> — one filter
  with live slider controls writing a named uniform before each redraw.
- <PlayLink to="image-processing/multi-filters">Multi-filters</PlayLink> — three
  single-pass filters sharing one vertex schema, each with its own pipeline.
- <PlayLink to="image-processing/mix-images">Mix images</PlayLink> — blend two
  textures in one shader, reusing a single sampler for both.
- <PlayLink to="image-processing/load-svg">Load SVG</PlayLink> — rasterize an SVG via
  a blob loader and upload it as a texture.
- <PlayLink to="image-processing/premultiply-alpha">Premultiply alpha</PlayLink> —
  composite the canvas over the page background with a premultiplied-alpha
  context and matching shader output.
- <PlayLink to="image-processing/texture-config">Texture config</PlayLink> — explore
  sampler and texture options (wrap, filter, `flipY`), rebuilding the immutable
  sampler on each change.

## 3D models

Lit geometry, normal matrices, and physically based shading.

- <PlayLink to="3d-models/basic-lighting">Basic lighting</PlayLink> — directional
  lighting with interactive controls for model rotation and light
  direction/color/strength.
- <PlayLink to="3d-models/material-ball">Material ball</PlayLink> — a PBR sphere using
  environment maps and a BRDF LUT, with the uniform struct laid out to std140.
- <PlayLink to="3d-models/material-balls">Material balls</PlayLink> — a grid of PBR
  balls sweeping roughness and metalness, one `uniforms` resource per ball.

## Offscreen

Render-to-texture targets: draw into an offscreen `Target`, then sample its
color or depth in a second pass.

- <PlayLink to="offscreen/basic-mesh">Basic mesh</PlayLink> — render a lit mesh into a
  color + depth target, then blit that color onto a full-screen quad.
- <PlayLink to="offscreen/basic-shadow">Basic shadow</PlayLink> — a two-pass shadow
  map: render depth from the light's view, then shade from the camera with a
  comparison sampler.
- <PlayLink to="offscreen/visualize-depth">Visualize depth</PlayLink> — fill an
  offscreen depth buffer, then sample `target.depth` into a grayscale view.

## Effects

Multi-pass and ping-pong techniques.

- <PlayLink to="effects/conway">Conway</PlayLink> — Conway's Game of Life on the GPU,
  ping-ponging state between two targets with a step pipeline and a display
  pipeline.
- <PlayLink to="effects/image-explode">Image explode</PlayLink> — a grid of textured
  quads that explode outward and reassemble, animated by a progress uniform.

## Design patterns

Higher-level structure built on the terse core.

- <PlayLink to="design-patterns/build-renderer">Build renderer</PlayLink> — wrap
  `beam-gpu` in a small `MeshRenderer` / `Mesh` abstraction that owns the device,
  pipelines, and scene, keeping the app code tiny.
