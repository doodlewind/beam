// Brightness / contrast filter on a full-screen quad.
//   vertex { position, texCoord } -> @location(0), @location(1)
//   uniforms { brightness, contrast } -> @group(0) @binding(0)
//   textures { img } -> @group(1) @binding(0); samplers { samp } -> @binding(1)
struct Uniforms {
  brightness : f32,
  contrast   : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var img : texture_2d<f32>;
@group(1) @binding(1) var samp : sampler;

struct VsOut {
  @builtin(position) pos : vec4f,
  @location(0)       uv  : vec2f,
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

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  var color = textureSample(img, samp, in.uv);
  color = vec4f(color.rgb + u.brightness, color.a);
  if (u.contrast > 0.0) {
    color = vec4f((color.rgb - 0.5) / (1.0 - u.contrast) + 0.5, color.a);
  } else {
    color = vec4f((color.rgb - 0.5) * (1.0 + u.contrast) + 0.5, color.a);
  }
  return color;
}
