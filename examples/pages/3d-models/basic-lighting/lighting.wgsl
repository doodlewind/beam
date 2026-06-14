// Diffuse (Lambert) lighting on a mesh. Binding convention (DESIGN §4):
//   vertex schema { position, normal }                 -> @location(0), @location(1)
//   uniforms { modelMat, viewMat, projectionMat,
//              normalMat, lightDir, lightColor, strength } -> @group(0) @binding(0)
struct Uniforms {
  modelMat      : mat4x4f,
  viewMat       : mat4x4f,
  projectionMat : mat4x4f,
  normalMat     : mat4x4f,
  lightDir      : vec3f,
  strength      : f32,     // scalar fills the vec3 trailing pad (std140)
  lightColor    : vec3f,
  _pad          : f32,
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
  out.normal = normal;
  out.pos = u.projectionMat * u.viewMat * u.modelMat * vec4f(position, 1.0);
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  let nm = mat3x3f(u.normalMat[0].xyz, u.normalMat[1].xyz, u.normalMat[2].xyz);
  let normalDir = normalize(nm * in.normal);
  let nDotL = max(dot(normalDir, normalize(u.lightDir)), 0.0);
  return vec4f(u.lightColor * nDotL * u.strength, 1.0);
}
