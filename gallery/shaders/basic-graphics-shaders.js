import { SchemaTypes, GLTypes } from '../../src/index.js'

const colorVS = `
attribute vec4 position;
attribute vec4 color;

varying highp vec4 vColor;

void main() {
  vColor = color;
  gl_Position = position;
}
`

const colorFS = `
varying highp vec4 vColor;

void main() {
  gl_FragColor = vColor;
}
`

const { vec4 } = SchemaTypes

export const PolygonColor = {
  vs: colorVS,
  fs: colorFS,
  buffers: {
    position: { type: vec4, n: 3 },
    color: { type: vec4, n: 3 }
  }
}

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

const normalFS = colorFS

const identityMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

const { vec2, mat4, tex2D } = SchemaTypes

export const NormalColor = {
  vs: normalVS,
  fs: normalFS,
  buffers: {
    position: { type: vec4, n: 3 },
    normal: { type: vec4, n: 3 }
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
  gl_Position = projectionMat * viewMat * modelMat * position;
}
`

const wireframeFS = `
void main() {
  gl_FragColor = vec4(34./256., 84./256., 244./256., 1);
}
`

export const RedWireframe = {
  vs: wireframeVS,
  fs: wireframeFS,
  buffers: {
    position: { type: vec4, n: 3 }
  },
  uniforms: {
    modelMat: { type: mat4, default: identityMat },
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 }
  },
  mode: GLTypes.Lines
}

const imageVS = `
precision highp float;
attribute vec4 position;
attribute vec2 texCoord;

uniform mat4 modelMat;
uniform mat4 viewMat;
uniform mat4 projectionMat;

varying vec2 vTexCoord;

void main() {
  gl_Position = projectionMat * viewMat * modelMat * position;
  vTexCoord = texCoord;
}
`

const imageFS = `
precision highp float;
uniform sampler2D img;
uniform float strength;

varying vec2 vTexCoord;

void main() {
  gl_FragColor = texture2D(img, vTexCoord);
}
`

export const ImageColor = {
  vs: imageVS,
  fs: imageFS,
  buffers: {
    position: { type: vec4, n: 3 },
    texCoord: { type: vec2 }
  },
  uniforms: {
    modelMat: { type: mat4, default: identityMat },
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 }
  },
  textures: {
    img: { type: tex2D }
  }
}
