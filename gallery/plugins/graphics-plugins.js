import { SchemaTypes, GLTypes } from '../../src/index.js'

const normalVS = `
attribute vec4 position;
attribute vec4 normal;

uniform mat4 modelMat;
uniform mat4 viewMat;
uniform mat4 projectionMat;

varying highp vec4 vColor;

void main() {
  gl_Position = projectionMat * viewMat * modelMat * position;
  vColor = normal;
}
`

const normalFS = `
varying highp vec4 vColor;

void main() {
  gl_FragColor = vColor;
}
`

const { vec4, mat4, index } = SchemaTypes
const identityMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

export const NormalGraphics = {
  vs: normalVS,
  fs: normalFS,
  buffers: {
    position: { type: vec4, n: 3 },
    normal: { type: vec4, n: 3 },
    index: { type: index }
  },
  uniforms: {
    modelMat: { type: mat4, default: identityMat },
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 }
  }
}

const wireframeVS = `
attribute vec4 position;

uniform mat4 modelMat;
uniform mat4 viewMat;
uniform mat4 projectionMat;

void main() {
  gl_Position = projectionMat * viewMat * modelMat * pos;
}
`

const wireframeFS = `
void main() {
  gl_FragColor = vec4(1, 0, 0, 1);
}
`

export const WireframeGraphics = {
  vs: wireframeVS,
  fs: wireframeFS,
  buffers: {
    position: { type: vec4, n: 3 },
    index: { type: index }
  },
  uniforms: {
    modelMat: { type: mat4, default: identityMat },
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 }
  },
  mode: GLTypes.lines
}
