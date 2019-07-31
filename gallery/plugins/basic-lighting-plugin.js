import { SchemaTypes } from '../../src/index.js'

const lambertVS = `
precision highp float;

attribute vec4 position;
attribute vec4 normal;

uniform mat4 modelMat;
uniform mat4 viewMat;
uniform mat4 projectionMat;

uniform mat4 lightViewMat;
uniform mat4 lightProjectionMat;

varying vec4 vPosFromLight;
varying vec4 vNormal;

void main() {
  vNormal = normal;
  vPosFromLight = lightProjectionMat * lightViewMat * position;
  gl_Position = projectionMat * viewMat * modelMat * position;
}
`

/*
const lambertFS = `
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
  float nDotL = max(dot(normalDir, normalize(dirLight.direction)), 0.0);
  vec4 dirLight = vec4(dirLight.color * nDotL * dirLight.strength, 1.0);
  gl_FragColor = dirLight;
}
`
*/

const lambertFS = `
precision highp float;

struct DirectionalLight {
  vec3 direction;
  vec3 color;
  float strength;
};
uniform DirectionalLight dirLight;
uniform mat4 normalMat;
uniform sampler2D shadowMap;

varying vec4 vPosFromLight;
varying vec4 vNormal;

float unpackDepth(const in vec4 rgbaDepth) {
  const vec4 bitShift = vec4(
    1.0, 1.0 / 256.0, 1.0 / (256.0 * 256.0), 1.0 / (256.0 * 256.0 * 256.0)
  );
  float depth = dot(rgbaDepth, bitShift);
  return depth;
}


void main() {
  vec3 shadowCoord = (vPosFromLight.xyz / vPosFromLight.w) / 2.0 + 0.5;
  vec4 rgbaDepth = texture2D(shadowMap, shadowCoord.xy);
  float depth = unpackDepth(rgbaDepth);
  float visibility = (shadowCoord.z > depth + 0.0015) ? 0.7 : 1.0;

  vec3 normalDir = normalize(vec3(normalMat * vNormal));
  float nDotL = max(dot(normalDir, normalize(dirLight.direction)), 0.0);
  vec4 dirLight = vec4(dirLight.color * nDotL * dirLight.strength, 1.0);
  // gl_FragColor = dirLight;

  gl_FragColor = vec4(dirLight.rgb * visibility, dirLight.a);
  // gl_FragColor = vec4(vec3(visibility), 1); // visualization
}
`

const { float, vec3, vec4, mat4, tex2D } = SchemaTypes
const identityMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

export const LambertLighting = {
  vs: lambertVS,
  fs: lambertFS,
  buffers: {
    position: { type: vec4, n: 3 },
    normal: { type: vec4, n: 3 }
  },
  uniforms: {
    modelMat: { type: mat4, default: identityMat },
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 },
    lightViewMat: { type: mat4 },
    lightProjectionMat: { type: mat4 },
    normalMat: { type: mat4, default: identityMat },
    'dirLight.direction': { type: vec3, default: [1, 1, 1] },
    'dirLight.color': { type: vec3, default: [1, 1, 1] },
    'dirLight.strength': { type: float, default: 0.5 }
  },
  textures: {
    shadowMap: { type: tex2D }
  }
}

const shadowVS = `
precision highp float;

attribute vec4 position;

uniform mat4 modelMat;
uniform mat4 viewMat;
uniform mat4 projectionMat;

void main() {
  gl_Position = projectionMat * viewMat * modelMat * position;
}
`

const shadowFS = `
precision highp float;

void main() {
  const vec4 bitShift = vec4(1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0);
  const vec4 bitMask = vec4(1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0, 0.0);
  vec4 rgbaDepth = fract(gl_FragCoord.z * bitShift);
  rgbaDepth -= rgbaDepth.gbaa * bitMask;
  gl_FragColor = rgbaDepth;
  // gl_FragColor = vec4(rgbaDepth.rgb, 1); // visualization
}
`

export const ShadowMap = {
  vs: shadowVS,
  fs: shadowFS,
  buffers: {
    position: { type: vec4, n: 3 }
  },
  uniforms: {
    modelMat: { type: mat4, default: identityMat },
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 }
  }
}
