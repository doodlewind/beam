// Full-screen quad that samples a depth texture and shows it as grayscale.
//   vertex { position, texCoord } -> @location(0), @location(1)
//   uniforms -> @group(0) @binding(0)
//   textures { depth } -> @group(1) @binding(0)
//   samplers { samp } -> @group(1) @binding(1)
struct Uniforms {
  nearPlane : f32,
  farPlane : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var depthTex : texture_depth_2d;
@group(1) @binding(1) var samp : sampler;

struct VsOut {
  @builtin(position) pos : vec4f,
  @location(0) uv : vec2f,
};

@vertex
fn vs(
  @location(0) position : vec3f,
  @location(1) texCoord : vec2f,
) -> VsOut {
  var out : VsOut;
  out.pos = vec4f(position, 1.0);
  out.uv = texCoord;
  return out;
}

// WebGPU clip-space depth is already in [0, 1]; convert the non-linear
// perspective depth into a linear distance, then normalize by farPlane.
fn linearize(depth : f32) -> f32 {
  let n = u.nearPlane;
  let f = u.farPlane;
  return (n * f) / (f - depth * (f - n));
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  let depth = textureSample(depthTex, samp, in.uv);
  let g = linearize(depth) / u.farPlane;
  return vec4f(vec3f(g), 1.0);
}
