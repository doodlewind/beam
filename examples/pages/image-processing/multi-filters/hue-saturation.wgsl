// Full-screen quad sampling `img`, adjusting hue and saturation.
struct Uniforms {
  hue        : f32,
  saturation : f32,
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
  var color = textureSample(img, samp, in.texCoord);

  // hue rotation about {1,1,1}
  let angle = u.hue * 3.14159265;
  let s = sin(angle);
  let c = cos(angle);
  let weights = (vec3f(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
  let rgb = color.rgb;
  color = vec4f(
    dot(rgb, weights.xyz),
    dot(rgb, weights.zxy),
    dot(rgb, weights.yzx),
    color.a,
  );

  // saturation
  let average = (color.r + color.g + color.b) / 3.0;
  if (u.saturation > 0.0) {
    color = vec4f(color.rgb + (average - color.rgb) * (1.0 - 1.0 / (1.001 - u.saturation)), color.a);
  } else {
    color = vec4f(color.rgb + (average - color.rgb) * (-u.saturation), color.a);
  }
  return color;
}
