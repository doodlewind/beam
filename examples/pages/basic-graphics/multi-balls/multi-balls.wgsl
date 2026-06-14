// Normal-as-color ball. Binding convention (DESIGN §4):
//   vertex schema { position, normal } -> @location(0), @location(1)
//   uniforms schema { modelMat, viewMat, projectionMat } -> @group(0) @binding(0)
struct Uniforms {
  modelMat      : mat4x4f,
  viewMat       : mat4x4f,
  projectionMat : mat4x4f,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VsOut {
  @builtin(position) pos    : vec4f,
  @location(0)       normal : vec3f,
};

@vertex
fn vs(
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
) -> VsOut {
  var out : VsOut;
  out.pos = u.projectionMat * u.viewMat * u.modelMat * vec4f(position, 1.0);
  out.normal = normal;
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  return vec4f(in.normal, 1.0);
}
