// Full-screen quad sampling `img`, applying a radial vignette.
struct Uniforms {
  vignette : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var img : texture_2d<f32>;
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
  let innerVig = 1.0 - u.vignette;
  let outerVig = 1.0001;

  var color = textureSample(img, samp, in.texCoord).rgb;
  let center = vec2f(0.5, 0.5);
  let dist = distance(center, in.texCoord) * 1.414213;
  let vig = clamp((outerVig - dist) / (outerVig - innerVig), 0.0, 1.0);
  color = color * vig;
  return vec4f(color, 1.0);
}
