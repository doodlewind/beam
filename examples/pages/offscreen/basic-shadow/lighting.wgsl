// Pass 2: render the scene from the camera, shading each fragment with a single
// directional light and darkening it where the shadow map says it is occluded.
//   vertex { position, normal }   -> @location(0), @location(1)
//   uniforms                      -> @group(0) @binding(0)
//   textures { shadowMap }        -> @group(1) @binding(0)  (texture_depth_2d)
//   samplers { shadowSamp }       -> @group(1) @binding(1)  (sampler_comparison)
struct Uniforms {
  modelMat : mat4x4f,
  viewMat : mat4x4f,
  projectionMat : mat4x4f,
  lightSpaceMat : mat4x4f,
  normalMat : mat4x4f,
  lightDir : vec3f,
  strength : f32,
  lightColor : vec3f,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var shadowMap : texture_depth_2d;
@group(1) @binding(1) var shadowSamp : sampler_comparison;

struct VsOut {
  @builtin(position) pos : vec4f,
  @location(0) normal : vec3f,
  @location(1) lightSpacePos : vec4f,
};

@vertex
fn vs(
  @location(0) position : vec3f,
  @location(1) normal : vec3f,
) -> VsOut {
  var out : VsOut;
  out.normal = normal;
  out.lightSpacePos = u.lightSpaceMat * u.modelMat * vec4f(position, 1.0);
  out.pos = u.projectionMat * u.viewMat * u.modelMat * vec4f(position, 1.0);
  return out;
}

// Returns 1.0 when lit, 0.0 when fully in shadow, using a comparison sampler.
fn shadowLit(lightSpacePos : vec4f, bias : f32) -> f32 {
  var proj = lightSpacePos.xyz / lightSpacePos.w;
  // WebGPU clip XY -> [0,1] UV (flip Y); clip Z is already [0,1].
  let uv = vec2f(proj.x * 0.5 + 0.5, proj.y * -0.5 + 0.5);
  // Outside the light frustum: treat as lit.
  if (proj.z > 1.0 || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return 1.0;
  }
  return textureSampleCompare(shadowMap, shadowSamp, uv, proj.z - bias);
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  let normalMat = mat3x3f(u.normalMat[0].xyz, u.normalMat[1].xyz, u.normalMat[2].xyz);
  let n = normalize(normalMat * in.normal);
  let l = normalize(u.lightDir);
  let nDotL = max(dot(n, l), 0.0);

  let bias = max(0.005 * (1.0 - nDotL), 0.0015);
  let lit = shadowLit(in.lightSpacePos, bias);

  let color = u.lightColor * nDotL * u.strength * lit;
  return vec4f(color, 1.0);
}
