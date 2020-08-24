import { SchemaTypes } from '../../../src/index.js'

const conwayVS = `
attribute vec4 position;
attribute vec2 texCoord;

varying highp vec2 vTexCoord;

void main() {
  gl_Position = position;
  vTexCoord = texCoord;
}
`

const conwayFS = `
precision highp float;
uniform sampler2D state;
varying vec2 vTexCoord;

const float size = 1.0 / 2048.0;
const float decay = 0.95;

void main() {
  float total = 0.0;
  total += texture2D(state, vTexCoord + vec2(-1.0, -1.0) * size).x > 0.5 ? 1.0 : 0.0;
  total += texture2D(state, vTexCoord + vec2(0.0, -1.0) * size).x > 0.5 ? 1.0 : 0.0;
  total += texture2D(state, vTexCoord + vec2(1.0, -1.0) * size).x > 0.5 ? 1.0 : 0.0;
  total += texture2D(state, vTexCoord + vec2(-1.0, 0.0) * size).x > 0.5 ? 1.0 : 0.0;
  total += texture2D(state, vTexCoord + vec2(1.0, 0.0) * size).x > 0.5 ? 1.0 : 0.0;
  total += texture2D(state, vTexCoord + vec2(-1.0, 1.0) * size).x > 0.5 ? 1.0 : 0.0;
  total += texture2D(state, vTexCoord + vec2(0.0, 1.0) * size).x > 0.5 ? 1.0 : 0.0;
  total += texture2D(state, vTexCoord + vec2(1.0, 1.0) * size).x > 0.5 ? 1.0 : 0.0;

  vec3 old = texture2D(state, vTexCoord).xyz;
  gl_FragColor = vec4(0.0, old.yz * decay, 1.0);

  if (old.x == 0.0) {
    if (total == 3.0) {
      gl_FragColor = vec4(1.0);
    }
  } else if (total == 2.0 || total == 3.0) {
    gl_FragColor = vec4(1.0);
  }
}
`

const { vec2, vec4, tex2D } = SchemaTypes

export const ConwayLifeGame = {
  vs: conwayVS,
  fs: conwayFS,
  buffers: {
    position: { type: vec4, n: 3 },
    texCoord: { type: vec2, n: 2 }
  },
  textures: {
    state: { type: tex2D }
  }
}
