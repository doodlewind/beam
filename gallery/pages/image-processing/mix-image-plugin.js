import { SchemaTypes } from '../../../src/index.js'

const vs = `
precision highp float;
attribute vec4 position;
attribute vec2 texCoord;

uniform mat4 modelMat;
uniform mat4 viewMat;
uniform mat4 projectionMat;

varying vec2 vTexCoord;

void main() {
  gl_Position = projectionMat * viewMat * position;
  vTexCoord = texCoord;
}
`

const fs = `
precision highp float;
uniform sampler2D img0;
uniform sampler2D img1;
uniform float strength;

varying vec2 vTexCoord;

void main() {
  vec4 color0 = texture2D(img0, vTexCoord);
  vec4 color1 = texture2D(img1, vTexCoord);
  gl_FragColor = color0 * color1.r;
  // gl_FragColor = color0 * (1.0 - color1.r); // try this
}
`

const { vec2, vec4, mat4, tex2D } = SchemaTypes

export const MixImage = {
  vs,
  fs,
  buffers: {
    position: { type: vec4, n: 3 },
    texCoord: { type: vec2 }
  },
  uniforms: {
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 }
  },
  textures: {
    img0: { type: tex2D },
    img1: { type: tex2D }
  }
}
