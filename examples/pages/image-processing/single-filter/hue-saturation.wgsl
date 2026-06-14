// Hue / saturation filter on a full-screen quad.
struct Uniforms {
  hue        : f32,
  saturation : f32,
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
  var rgb = textureSample(img, samp, in.uv).rgb;

  // hue adjustment: RotationTransform[angle, {1, 1, 1}]
  let angle = u.hue * 3.14159265;
  let s = sin(angle);
  let c = cos(angle);
  let weights = (vec3f(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
  rgb = vec3f(
    dot(rgb, weights.xyz),
    dot(rgb, weights.zxy),
    dot(rgb, weights.yzx),
  );

  // saturation adjustment
  let average = (rgb.r + rgb.g + rgb.b) / 3.0;
  if (u.saturation > 0.0) {
    rgb += (average - rgb) * (1.0 - 1.0 / (1.001 - u.saturation));
  } else {
    rgb += (average - rgb) * (-u.saturation);
  }
  return vec4f(rgb, 1.0);
}
