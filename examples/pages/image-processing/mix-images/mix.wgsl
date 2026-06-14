// Mix two textures in one shader (DESIGN §4).
//   vertex { position, texCoord } -> @location(0), @location(1)
//   uniforms { viewMat, projectionMat } -> @group(0) @binding(0)
//   textures { img0, img1 } -> @group(1) @binding(0..1)
//   samplers { samp }       -> @group(1) @binding(2)
struct Uniforms {
  viewMat       : mat4x4f,
  projectionMat : mat4x4f,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var img0 : texture_2d<f32>;
@group(1) @binding(1) var img1 : texture_2d<f32>;
@group(1) @binding(2) var samp : sampler;

struct VsOut {
  @builtin(position) pos      : vec4f,
  @location(0)       texCoord : vec2f,
};

@vertex
fn vs(
  @location(0) position : vec3f,
  @location(1) texCoord : vec2f,
) -> VsOut {
  var out : VsOut;
  out.pos = u.projectionMat * u.viewMat * vec4f(position, 1.0);
  out.texCoord = texCoord;
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  let color0 = textureSample(img0, samp, in.texCoord);
  let color1 = textureSample(img1, samp, in.texCoord);
  // Mask the logo with the black hole's red channel.
  return color0 * color1.r;
}
