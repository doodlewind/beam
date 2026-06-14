import { SchemaTypes } from '../../../src/index.js'

const vs = `
attribute vec4 position;
attribute vec2 texCoord;

varying highp vec2 vTexCoord;

void main() {
  vTexCoord = texCoord;
  gl_Position = position;
}
`

const fs = `
varying highp vec2 vTexCoord;
uniform highp float scale;
uniform sampler2D img;

void main() {
  gl_FragColor = texture2D(img, vTexCoord * scale);
}
`

const { vec2, vec4, float, tex2D } = SchemaTypes
export const PolygonTexture = {
  vs,
  fs,
  buffers: {
    position: { type: vec4, n: 3 },
    texCoord: { type: vec2 }
  },
  uniforms: {
    scale: { type: float, default: 1 }
  },
  textures: {
    img: { type: tex2D }
  }
}
