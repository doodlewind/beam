// Conway step. Samples the previous state texture, applies the Game of Life
// rules over the 8 neighbours, and writes the next state. A faint decaying
// trail is kept in the g/b channels for a nicer look.
//   vertex { position, texCoord } -> @location(0), @location(1)
//   textures { state } + samplers { samp } -> @group(1)
struct VsOut {
  @builtin(position) pos    : vec4f,
  @location(0)       uv     : vec2f,
};

@group(1) @binding(0) var state : texture_2d<f32>;
@group(1) @binding(1) var samp  : sampler;

const size  = 1.0 / 2048.0;
const decay = 0.95;

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

fn alive(uv : vec2f, dx : f32, dy : f32) -> f32 {
  let c = textureSample(state, samp, uv + vec2f(dx, dy) * size).x;
  return select(0.0, 1.0, c > 0.5);
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  var total = 0.0;
  total += alive(in.uv, -1.0, -1.0);
  total += alive(in.uv,  0.0, -1.0);
  total += alive(in.uv,  1.0, -1.0);
  total += alive(in.uv, -1.0,  0.0);
  total += alive(in.uv,  1.0,  0.0);
  total += alive(in.uv, -1.0,  1.0);
  total += alive(in.uv,  0.0,  1.0);
  total += alive(in.uv,  1.0,  1.0);

  let old = textureSample(state, samp, in.uv).xyz;
  var color = vec4f(0.0, old.yz * decay, 1.0);

  if (old.x == 0.0) {
    if (total == 3.0) { color = vec4f(1.0); }
  } else if (total == 2.0 || total == 3.0) {
    color = vec4f(1.0);
  }
  return color;
}
