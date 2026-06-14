# legacy/

This is the **original WebGL implementation** of Beam (`beam-gl`), preserved here
for reference after the TypeScript + native-WebGPU rewrite.

- `src/` — the original ~1.1k-LOC WebGL library (`beam.shader` / `resource` / `draw`).
- `gallery/` — the original WebGL examples and shaders (GLSL).
- `examples.html` — the original static example gallery.

None of it is part of the new build. The new library lives in `../packages/beam`
(`beam-gpu`), the ported examples in `../examples`, and the docs in `../docs`.
See `../DESIGN.md` for the API design and the WebGL→WebGPU migration map.

This directory can be deleted entirely once you no longer need the WebGL original
as a reference — git history retains it either way.
