import { SchemaTypes } from '../../../src/index.js'

const defaultVS = `
attribute vec4 position;
attribute vec2 texCoord;

varying highp vec2 vTexCoord;

void main() {
  gl_Position = position;
  vTexCoord = texCoord;
}
`

const defaultFS = `
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

  // gl_FragColor = vec4(texture2D(img, vTexCoord).rgb, 1.0);
  // gl_FragColor = vec4(vec3(depthValue), 1.0);
  gl_FragColor = vec4(vec3(linearizeDepth(depthValue) / farPlane), 1.0);
}
`

const { vec2, vec4, float, tex2D } = SchemaTypes

export const CheckDepth = {
  vs: defaultVS,
  fs: defaultFS,
  buffers: {
    position: { type: vec4, n: 3 },
    texCoord: { type: vec2 }
  },
  uniforms: {
    nearPlane: { type: float },
    farPlane: { type: float }
  },
  textures: {
    img: { type: tex2D }
  }
}
