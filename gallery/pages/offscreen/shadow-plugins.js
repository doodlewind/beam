import { SchemaTypes } from '../../../src/index.js'

const { vec2, vec3, vec4, mat4, float, tex2D } = SchemaTypes
const identityMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

const checkDepthVS = `
attribute vec4 position;
attribute vec2 texCoord;

varying highp vec2 vTexCoord;

void main() {
  gl_Position = position;
  vTexCoord = texCoord;
}
`

const checkDepthFS = `
precision highp float;
uniform sampler2D img;

varying highp vec2 vTexCoord;

uniform float nearPlane;
uniform float farPlane;

// Required when using a perspective projection matrix
float linearizeDepth(float depth) {
  float z = depth * 2.0 - 1.0; // Back to NDC 
  return (2.0 * nearPlane * farPlane) / (farPlane + nearPlane - z * (farPlane - nearPlane));
}

void main() {
  float depthValue = texture2D(img, vTexCoord).r;

  #ifdef USE_ORTHO
  gl_FragColor = vec4(texture2D(img, vTexCoord).rgb, 1.0); // for ortho
  #else
  // gl_FragColor = vec4(vec3(depthValue), 1.0);
  gl_FragColor = vec4(vec3(linearizeDepth(depthValue) / farPlane), 1.0); // for perspective
  #endif
}
`

export const CheckDepth = {
  vs: checkDepthVS,
  fs: checkDepthFS,
  defines: {
    USE_ORTHO: false
  },
  buffers: {
    position: { type: vec4, n: 3 },
    texCoord: { type: vec2 }
  },
  uniforms: {
    nearPlane: { type: float, default: 0.1 },
    farPlane: { type: float, default: 100 }
  },
  textures: {
    img: { type: tex2D }
  }
}

const voidVS = `
precision highp float;

attribute vec4 position;
uniform mat4 modelMat;
uniform mat4 viewMat;
uniform mat4 projectionMat;

void main() {
  gl_Position = projectionMat * viewMat * modelMat * position;
}
`

const voidFS = `
void main() {
  gl_FragColor = vec4(0, 0, 0, 0);
}
`

export const VoidDepth = {
  vs: voidVS,
  fs: voidFS,
  buffers: {
    position: { type: vec4, n: 3 }
  },
  uniforms: {
    modelMat: { type: mat4, default: identityMat },
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 }
  }
}

const lightingVS = `
precision highp float;

attribute vec4 position;
attribute vec4 normal;

uniform mat4 modelMat;
uniform mat4 viewMat;
uniform mat4 projectionMat;
uniform mat4 lightSpaceMat;

varying vec4 vNormal;
varying vec4 vLightSpacePosition;

void main() {
  vNormal = normal;
  vLightSpacePosition = lightSpaceMat * modelMat * position;
  gl_Position = projectionMat * viewMat * modelMat * position;
}
`

const lightingFS = `
precision highp float;

struct DirectionalLight {
  vec3 direction;
  vec3 color;
  float strength;
};
uniform DirectionalLight dirLight;
uniform mat4 normalMat;

uniform vec3 lightPosition;
// uniform vec3 viewPosition;

uniform sampler2D shadowMap;

varying vec4 vNormal;
varying vec4 vLightSpacePosition;

float computeShadow(vec4 lightSpacePosition) {
  vec3 projCoords = lightSpacePosition.xyz / lightSpacePosition.w;
  projCoords = projCoords * 0.5 + 0.5;
  float closestDepth = texture2D(shadowMap, projCoords.xy).r;
  float currentDepth = projCoords.z;

  float bias = max(0.05 * (1.0 - dot(vNormal.xyz, lightPosition)), 0.005);
  float shadow = currentDepth - bias > closestDepth ? 1.0 : 0.0;

  // disable shadow outside the shadow camera
  if (projCoords.z > 1.0) shadow = 0.0;
  return shadow;
}

void main() {
  vec3 normalDir = normalize(vec3(normalMat * vNormal));
  float nDotL = max(dot(normalDir, normalize(dirLight.direction)), 0.0);
  vec4 dirLight = vec4(dirLight.color * nDotL * dirLight.strength, 1.0);
  dirLight.rgb = dirLight.rgb * (1.0 - computeShadow(vLightSpacePosition));
  gl_FragColor = dirLight;
}
`

export const ShadowLighting = {
  vs: lightingVS,
  fs: lightingFS,
  buffers: {
    position: { type: vec4, n: 3 },
    normal: { type: vec4, n: 3 }
  },
  uniforms: {
    modelMat: { type: mat4, default: identityMat },
    viewMat: { type: mat4 },
    projectionMat: { type: mat4 },
    lightSpaceMat: { type: mat4 },
    lightPosition: { type: vec3 },
    // viewPosition: { type: vec3 },
    normalMat: { type: mat4, default: identityMat },
    'dirLight.direction': { type: vec3, default: [1, 1, 1] },
    'dirLight.color': { type: vec3, default: [1, 1, 1] },
    'dirLight.strength': { type: float, default: 0.5 }
  },
  textures: {
    shadowMap: { type: tex2D }
  }
}
