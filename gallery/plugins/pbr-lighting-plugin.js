import { SchemaTypes } from '../../src/index.js'
import { vs, fs } from './pbr-lighting-shaders.js'

const { float, vec2, vec3, vec4, mat4, tex2D, texCube } = SchemaTypes
const identityMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

export const PBRLighting = {
  vs,
  fs,
  defines: {
    USE_IBL: 1,
    HAS_NORMALS: 1,
    HAS_UV: 1,
    HAS_BASECOLORMAP: 1,
    HAS_METALROUGHNESSMAP: 1,
    HAS_NORMALMAP: 1,
    // HAS_EMISSIVEMAP: 1,
    // HAS_OCCLUSIONMAP: 1,
    // HAS_TANGENTS: 1,
    USE_TEX_LOD: 1,
    NR_POINT_LIGHTS: 3
  },
  buffers: {
    position: { type: vec4, n: 3 },
    texCoord: { type: vec2 },
    normal: { type: vec4, n: 3 }
  },
  uniforms: {
    u_Camera: { type: vec3 },
    u_MVPMatrix: { type: mat4 },
    u_ModelMatrix: { type: mat4, default: identityMat },
    u_NormalMatrix: { type: mat4, default: identityMat },
    'u_Lights[0].direction': { type: vec3 },
    'u_Lights[0].color': { type: vec3 },
    'u_Lights[0].strength': { type: float },
    'u_Lights[1].direction': { type: vec3 },
    'u_Lights[1].color': { type: vec3 },
    'u_Lights[1].strength': { type: float },
    'u_Lights[2].direction': { type: vec3 },
    'u_Lights[2].color': { type: vec3 },
    'u_Lights[2].strength': { type: float },
    u_BaseColorFactor: { type: vec4, default: [1, 1, 1, 1] },
    u_BaseColorScale: { type: float, default: 1 },
    u_NormalScale: { type: float, default: 1 },
    u_EmissiveFactor: { type: vec3, default: [1, 1, 1] },
    u_OcclusionStrength: { type: float, default: 1 },
    u_MetallicRoughnessValues: { type: vec2 },
    u_ScaleDiffBaseMR: { type: vec4, default: [0, 0, 0, 0] },
    u_ScaleFGDSpec: { type: vec4, default: [0, 0, 0, 0] },
    u_ScaleIBLAmbient: { type: vec4, default: [1, 1, 1, 1] }
  },
  textures: {
    u_DiffuseEnvSampler: { type: texCube },
    u_SpecularEnvSampler: { type: texCube },
    u_brdfLUT: { type: tex2D },
    u_BaseColorSampler: { type: tex2D, repeat: true },
    u_NormalSampler: { type: tex2D, repeat: true },
    u_MetallicRoughnessSampler: { type: tex2D, repeat: true },
    u_EmissiveSampler: { type: tex2D },
    u_OcclusionSampler: { type: tex2D }
  }
}
