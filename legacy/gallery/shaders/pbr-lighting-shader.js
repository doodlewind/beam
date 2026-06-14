import { SchemaTypes } from '../../src/index.js'

const vs = `#version 300 es
in vec4 position;
in vec4 normal;
in vec2 texCoord;

uniform mat4 uMVPMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uNormalMatrix;

out vec3 vPosition;
out vec2 vTexCoord;
out vec3 vNormal;

void main() {
  vec4 pos = uModelMatrix * position;
  vPosition = vec3(pos.xyz) / pos.w;
  vNormal = normalize(vec3(uModelMatrix * vec4(normal.xyz, 0.0)));
  vTexCoord = texCoord;
  gl_Position = uMVPMatrix * position;
}
`

const fs = `#version 300 es
#define USE_TEX_LOD true
precision highp float;

const float M_PI = 3.141592653589793;
const float MIN_ROUGHNESS = 0.04;
const int NR_POINT_LIGHTS = 3;

struct PointLight {
  vec3 direction;
  vec3 color;
  float strength;
};
uniform PointLight uLights[NR_POINT_LIGHTS];

uniform samplerCube uDiffuseEnvSampler;
uniform samplerCube uSpecularEnvSampler;
uniform sampler2D uBrdfLUT;

uniform sampler2D uBaseColorSampler;
uniform vec4 uBaseColorFactor;
uniform float uBaseColorScale;

uniform sampler2D uNormalSampler;
uniform float uNormalScale;

uniform sampler2D uMetallicRoughnessSampler;
uniform vec2 uMetallicRoughnessValues;

uniform vec3 uCamera;

// Debugging flags used for shader output of intermediate PBR variables
uniform vec4 uScaleDiffBaseMR;
uniform vec4 uScaleFGDSpec;
uniform vec4 uScaleIBLAmbient;

in vec3 vPosition;
in vec2 vTexCoord;
in vec3 vNormal;

out vec4 fragColor;

struct PBRInfo {
  float NdotL; // dot(normal, light direction)
  float NdotV; // dot(normal, view direction)
  float NdotH; // dot(normal, half vector)
  float LdotH; // dot(light direction, half vector)
  float VdotH; // dot(view direction, half vector)
  float perceptualRoughness; // roughness value, as authored by the model creator (input to shader)
  float metalness; // metallic value at the surface
  vec3 reflectance0; // full reflectance color (normal incidence angle)
  vec3 reflectance90; // reflectance color at grazing angle
  float alphaRoughness; // roughness mapped to a more linear change in the roughness
  vec3 diffuseColor; // color contribution from diffuse lighting
  vec3 specularColor; // color contribution from specular lighting
};

vec4 SRGBtoLINEAR(vec4 srgbIn) {
  // No manual SRGB by default
  return srgbIn;
}

vec3 getNormal() {
  // Retrieve the tangent space matrix
  vec3 pos_dx = dFdx(vPosition);
  vec3 pos_dy = dFdy(vPosition);
  vec3 tex_dx = dFdx(vec3(vTexCoord, 0.0));
  vec3 tex_dy = dFdy(vec3(vTexCoord, 0.0));
  vec3 t = (tex_dy.t * pos_dx - tex_dx.t * pos_dy) / (tex_dx.s * tex_dy.t - tex_dy.s * tex_dx.t);

  vec3 ng = normalize(vNormal);
  t = normalize(t - ng * dot(ng, t));
  vec3 b = normalize(cross(ng, t));
  mat3 tbn = mat3(t, b, ng);

  vec3 n = texture(uNormalSampler, vTexCoord).rgb;
  n = normalize(tbn * ((2.0 * n - 1.0) * vec3(uNormalScale, uNormalScale, 1.0)));
  return n;
}

vec3 getIBLContribution(PBRInfo pbrInputs, vec3 n, vec3 reflection) {
  float mipCount = 9.0; // resolution of 512x512
  float lod = (pbrInputs.perceptualRoughness * mipCount);
  // retrieve a scale and bias to F0. See [1], Figure 3
  vec3 brdf = SRGBtoLINEAR(texture(uBrdfLUT, vec2(pbrInputs.NdotV, 1.0 - pbrInputs.perceptualRoughness))).rgb;
  vec3 diffuseLight = SRGBtoLINEAR(texture(uDiffuseEnvSampler, n)).rgb;

  #ifdef USE_TEX_LOD
  vec3 specularLight = SRGBtoLINEAR(textureLod(uSpecularEnvSampler, reflection, lod)).rgb;
  #else
  vec3 specularLight = SRGBtoLINEAR(texture(uSpecularEnvSampler, reflection)).rgb;
  #endif

  vec3 diffuse = diffuseLight * pbrInputs.diffuseColor;
  vec3 specular = specularLight * (pbrInputs.specularColor * brdf.x + brdf.y);

  // For presentation, this allows us to disable IBL terms
  diffuse *= uScaleIBLAmbient.x;
  specular *= uScaleIBLAmbient.y;

  return diffuse + specular;
}

// Basic Lambertian diffuse
vec3 diffuse(PBRInfo pbrInputs) {
  return pbrInputs.diffuseColor / M_PI;
}

// Fresnel reflectance term of the spec equation (aka F())
vec3 specularReflection(PBRInfo pbrInputs) {
  return pbrInputs.reflectance0 + (pbrInputs.reflectance90 - pbrInputs.reflectance0) * pow(clamp(1.0 - pbrInputs.VdotH, 0.0, 1.0), 5.0);
}

// Specular geometric attenuation (aka G()),
// where rougher material will reflect less light back to the viewer.
float geometricOcclusion(PBRInfo pbrInputs) {
  float NdotL = pbrInputs.NdotL;
  float NdotV = pbrInputs.NdotV;
  float r = pbrInputs.alphaRoughness;

  float attenuationL = 2.0 * NdotL / (NdotL + sqrt(r * r + (1.0 - r * r) * (NdotL * NdotL)));
  float attenuationV = 2.0 * NdotV / (NdotV + sqrt(r * r + (1.0 - r * r) * (NdotV * NdotV)));
  return attenuationL * attenuationV;
}

// Distribution of microfacet normals across the area being drawn (aka D())
float microfacetDistribution(PBRInfo pbrInputs) {
  float roughnessSq = pbrInputs.alphaRoughness * pbrInputs.alphaRoughness;
  float f = (pbrInputs.NdotH * roughnessSq - pbrInputs.NdotH) * pbrInputs.NdotH + 1.0;
  return roughnessSq / (M_PI * f * f);
}

void main() {
  float perceptualRoughness = uMetallicRoughnessValues.y;
  float metallic = uMetallicRoughnessValues.x;
  // Roughness is stored in the 'g' channel, metallic is stored in the 'b' channel.
  // This layout intentionally reserves the 'r' channel for (optional) occlusion map data
  vec4 mrSample = texture(uMetallicRoughnessSampler, vTexCoord);
  perceptualRoughness = mrSample.g * perceptualRoughness;
  metallic = mrSample.b * metallic;
  perceptualRoughness = clamp(perceptualRoughness, MIN_ROUGHNESS, 1.0);
  metallic = clamp(metallic, 0.0, 1.0);
  // Roughness is authored as perceptual roughness; as is convention,
  // convert to material roughness by squaring the perceptual roughness [2].
  float alphaRoughness = perceptualRoughness * perceptualRoughness;

  vec4 baseColor = SRGBtoLINEAR(texture(uBaseColorSampler, vTexCoord / uBaseColorScale)) * uBaseColorFactor;

  vec3 f0 = vec3(0.04);
  vec3 diffuseColor = baseColor.rgb * (vec3(1.0) - f0);
  diffuseColor *= 1.0 - metallic;
  vec3 specularColor = mix(f0, baseColor.rgb, metallic);

  // Compute reflectance
  float reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);

  // For typical incident reflectance range (between 4% to 100%),
  // set the grazing reflectance to 100% for typical fresnel effect.
  // For very low reflectance range on highly diffuse objects (below 4%),
  // incrementally reduce grazing reflecance to 0%.
  float reflectance90 = clamp(reflectance * 25.0, 0.0, 1.0);
  vec3 specularEnvironmentR0 = specularColor.rgb;
  vec3 specularEnvironmentR90 = vec3(1.0, 1.0, 1.0) * reflectance90;

  vec3 n = getNormal(); // Normal at surface point
  vec3 v = normalize(uCamera - vPosition); // Vector from surface point to camera
  vec3 reflection = -normalize(reflect(v, n));

  vec3 color = vec3(0, 0, 0);
  float NdotL, NdotV, NdotH, LdotH, VdotH;
  PBRInfo pbrInputs;
  vec3 F;
  float G, D;
  vec3 diffuseContrib, specContrib;

  for(int i = 0; i < NR_POINT_LIGHTS; ++i) {
    vec3 l = normalize(uLights[i].direction);  // Vector from surface point to light
    vec3 h = normalize(l + v); // Half vector between l and v

    NdotL = clamp(dot(n, l), 0.001, 1.0);
    NdotV = clamp(abs(dot(n, v)), 0.001, 1.0);
    NdotH = clamp(dot(n, h), 0.0, 1.0);
    LdotH = clamp(dot(l, h), 0.0, 1.0);
    VdotH = clamp(dot(v, h), 0.0, 1.0);

    pbrInputs = PBRInfo(
      NdotL,
      NdotV,
      NdotH,
      LdotH,
      VdotH,
      perceptualRoughness,
      metallic,
      specularEnvironmentR0,
      specularEnvironmentR90,
      alphaRoughness,
      diffuseColor,
      specularColor
    );
    // Calculate the shading terms for the microfacet specular shading model
    F = specularReflection(pbrInputs);
    G = geometricOcclusion(pbrInputs);
    D = microfacetDistribution(pbrInputs);
    // Calculation of analytical lighting contribution
    diffuseContrib = (1.0 - F) * diffuse(pbrInputs);
    specContrib = F * G * D / (4.0 * NdotL * NdotV);
    // Obtain final intensity as reflectance (BRDF) scaled by the energy of light (cosine law)
    vec3 lightColor = NdotL * uLights[i].color * (diffuseContrib + specContrib);
    lightColor *= uLights[i].strength;
    color += lightColor;
  }

  // Calculate IBL contribution
  color += getIBLContribution(pbrInputs, n, reflection);

  // Use mix to override final color for reference app visualization
  // of various parameters in the lighting equation.
  color = mix(color, F, uScaleFGDSpec.x);
  color = mix(color, vec3(G), uScaleFGDSpec.y);
  color = mix(color, vec3(D), uScaleFGDSpec.z);
  color = mix(color, specContrib, uScaleFGDSpec.w);

  color = mix(color, diffuseContrib, uScaleDiffBaseMR.x);
  color = mix(color, baseColor.rgb, uScaleDiffBaseMR.y);
  color = mix(color, vec3(metallic), uScaleDiffBaseMR.z);
  color = mix(color, vec3(perceptualRoughness), uScaleDiffBaseMR.w);

  fragColor = vec4(pow(color,vec3(1.0/2.2)), baseColor.a);
  // fragColor = vec4(1, 0, 0, 1);
}
`

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
