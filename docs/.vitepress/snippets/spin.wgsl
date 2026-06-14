// spin.wgsl — colored triangle rotated by a `time` uniform.
//   vertex schema { position, color } -> @location(0), @location(1)
//   uniforms schema { time }          -> @group(0) @binding(0)
struct Uniforms {
  time : f32,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

struct VsOut {
  @builtin(position) pos   : vec4f,
  @location(0)       color : vec3f,
};

@vertex
fn vs(
  @location(0) position : vec3f,
  @location(1) color    : vec3f,
) -> VsOut {
  let a = u.time;
  let r = mat2x2f(cos(a), -sin(a), sin(a), cos(a));
  var out : VsOut;
  out.pos = vec4f(r * position.xy, position.z, 1.0);
  out.color = color;
  return out;
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  return vec4f(in.color, 1.0);
}
