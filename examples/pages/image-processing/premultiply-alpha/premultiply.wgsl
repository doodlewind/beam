// Composite a transparent PNG onto a `premultiplied`-alpha canvas.
//   vertex schema { position, texCoord } -> @location(0), @location(1)
//   uniforms      { premultiply }        -> @group(0) @binding(0)
//   textures      { img }                -> @group(1) @binding(0)
//   samplers      { samp }               -> @group(1) @binding(1)
struct Uniforms {
  premultiply : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

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
  // The PNG is decoded with straight (non-premultiplied) alpha.
  let color = textureSample(img, samp, in.texCoord);
  // The canvas is configured `alpha: 'premultiplied'`, so the browser expects
  // rgb to already be scaled by alpha. Multiply through when the toggle is on;
  // leave it straight (incorrect) when off to expose the dark-fringe artifact.
  if (u.premultiply > 0.5) {
    return vec4f(color.rgb * color.a, color.a);
  }
  return color;
}
