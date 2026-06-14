// Pass 1: render the scene from the light's point of view. We only care about
// the depth buffer (the shadow map); the color output is unused.
//   vertex { position }                          -> @location(0)
//   uniforms { modelMat, viewMat, projectionMat } -> @group(0) @binding(0)
struct Uniforms {
  modelMat : mat4x4f,
  viewMat : mat4x4f,
  projectionMat : mat4x4f,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

@vertex
fn vs(@location(0) position : vec3f) -> @builtin(position) vec4f {
  return u.projectionMat * u.viewMat * u.modelMat * vec4f(position, 1.0);
}

@fragment
fn fs() -> @location(0) vec4f {
  return vec4f(0.0, 0.0, 0.0, 1.0);
}
