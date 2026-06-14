// Screen pass: draw the offscreen color texture onto a full-screen quad.
//   vertex schema { position, texCoord } -> @location(0), @location(1)
//   textures { img } then samplers { samp } -> @group(1)
@group(1) @binding(0) var img  : texture_2d<f32>;
@group(1) @binding(1) var samp : sampler;

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
  out.pos = vec4f(position, 1.0);
  out.texCoord = texCoord;
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  return textureSample(img, samp, in.texCoord);
}
