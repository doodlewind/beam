import { SchemaTypes } from '../../src/index.js'
import { vs, fs } from './pbr-lighting-shaders.js'

const { float, vec2, vec3, vec4, mat4, tex2D, texCube } = SchemaTypes
const identityMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

export const PBRLighting = {
  vs,
  fs,
  buffers: {
    position: { type: vec4, n: 3 },
    texCoord: { type: vec2 },
    normal: { type: vec4, n: 3 }
  },
  uniforms: {
    uCamera: { type: vec3 },
    uMVPMatrix: { type: mat4 },
    uModelMatrix: { type: mat4, default: identityMat },
    uNormalMatrix: { type: mat4, default: identityMat },
    'uLights[0].direction': { type: vec3 },
    'uLights[0].color': { type: vec3 },
    'uLights[0].strength': { type: float },
    'uLights[1].direction': { type: vec3 },
    'uLights[1].color': { type: vec3 },
    'uLights[1].strength': { type: float },
    'uLights[2].direction': { type: vec3 },
    'uLights[2].color': { type: vec3 },
    'uLights[2].strength': { type: float },
    uBaseColorFactor: { type: vec4, default: [1, 1, 1, 1] },
    uBaseColorScale: { type: float, default: 1 },
    uNormalScale: { type: float, default: 1 },
    uMetallicRoughnessValues: { type: vec2 },
    uScaleDiffBaseMR: { type: vec4, default: [0, 0, 0, 0] },
    uScaleFGDSpec: { type: vec4, default: [0, 0, 0, 0] },
    uScaleIBLAmbient: { type: vec4, default: [1, 1, 1, 1] }
  },
  textures: {
    uDiffuseEnvSampler: { type: texCube },
    uSpecularEnvSampler: { type: texCube },
    uBrdfLUT: { type: tex2D },
    uBaseColorSampler: { type: tex2D },
    uNormalSampler: { type: tex2D },
    uMetallicRoughnessSampler: { type: tex2D }
  }
}
