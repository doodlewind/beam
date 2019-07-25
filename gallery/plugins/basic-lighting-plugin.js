import { SchemaTypes } from '../../src/index.js'

const vs = `
precision highp float;

attribute vec4 position;
attribute vec4 normal;

uniform mat4 modelMat;
uniform mat4 viewMat;
uniform mat4 projectionMat;

varying vec4 vNormal;

void main() {
  vNormal = normal;
  gl_Position = projectionMat * viewMat * modelMat * position;
}
`

const fs = `
precision highp float;

struct DirectionalLight {
  vec3 direction;
  vec3 color;
  float strength;
};
uniform DirectionalLight dirLight;
uniform mat4 normalMat;

varying vec4 vNormal;

void main() {
  vec3 normalDir = normalize(vec3(normalMat * vNormal));
  float nDotL = max(dot(normalDir, dirLight.direction), 0.0);
  vec4 dirLight = vec4(dirLight.color * nDotL * dirLight.strength, 1.0);
  gl_FragColor = dirLight;
}
`

const { float, vec3, vec4, mat4, index } = SchemaTypes
const identityMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

export const LambertLighting = {
  vs,
  fs,
  buffers: {
    position: { type: vec4, n: 3 },
    normal: { type: vec4, n: 3 }
  },
  uniforms: {
    modelMat: { type: mat4, default: identityMat },
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 },
    normalMat: { type: mat4, default: identityMat },
    'dirLight.direction': { type: vec3, default: [1, 0, 1] },
    'dirLight.color': { type: vec3, default: [1, 1, 1] },
    'dirLight.strength': { type: float, default: 0.5 }
  }
}
