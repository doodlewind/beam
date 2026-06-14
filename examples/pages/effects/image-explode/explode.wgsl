// Image explode. Binding convention (DESIGN §4):
//   vertex schema { position, center, texCoord } -> @location(0), (1), (2)
//   uniforms { viewMat, projectionMat, progress, aspectRatio }
//   textures { img } + samplers { samp } -> @group(1)
struct Uniforms {
  viewMat       : mat4x4f,
  projectionMat : mat4x4f,
  progress      : f32,
  aspectRatio   : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var img  : texture_2d<f32>;
@group(1) @binding(1) var samp : sampler;

struct VsOut {
  @builtin(position) pos      : vec4f,
  @location(0)       texCoord : vec2f,
};

const camera = vec3f(0.0, 0.0, 1.0);

fn rand(co : vec2f) -> f32 {
  return fract(sin(dot(co, vec2f(12.9898, 78.233))) * 43758.5453);
}

@vertex
fn vs(
  @location(0) position : vec2f,
  @location(1) center   : vec2f,
  @location(2) texCoord : vec2f,
) -> VsOut {
  let dir = normalize(vec3f(center, 0.0) * rand(center) - camera);
  let translated = vec3f(position.x * u.aspectRatio, position.y, 0.0) + dir * u.progress;

  var out : VsOut;
  out.pos = u.projectionMat * u.viewMat * vec4f(translated, 1.0);
  out.texCoord = texCoord;
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  let a = 1.0 - u.progress / 16.0;
  return vec4f(textureSample(img, samp, in.texCoord).rgb * a, 1.0);
}
