// PBR + image-based lighting (IBL), one ball per draw.
//   vertex  { position, normal }          -> @location(0), @location(1)
//   uniforms{ mvpMat, modelMat, camera, metalRough, lightDir, lightStrength,
//             lightColor }                 -> @group(0) @binding(0)
//   textures{ diffuseEnv, specularEnv, brdfLUT } then samplers{ samp }
//                                          -> @group(1)
struct Uniforms {
  mvpMat        : mat4x4f,
  modelMat      : mat4x4f,
  camera        : vec3f,
  lightStrength : f32,        // scalar fills camera's trailing pad
  metalRough    : vec2f,      // x = metallic, y = roughness
  lightDir      : vec3f,
  _pad          : f32,        // scalar fills lightDir's trailing pad
  lightColor    : vec3f,
};
@group(0) @binding(0) var<uniform> u : Uniforms;

@group(1) @binding(0) var diffuseEnv  : texture_cube<f32>;
@group(1) @binding(1) var specularEnv : texture_cube<f32>;
@group(1) @binding(2) var brdfLUT     : texture_2d<f32>;
@group(1) @binding(3) var samp        : sampler;

const PI = 3.141592653589793;
const MIN_ROUGHNESS = 0.04;
const MIP_COUNT = 9.0; // specular env resolution 512x512

struct VsOut {
  @builtin(position) pos    : vec4f,
  @location(0)       wpos   : vec3f,
  @location(1)       normal : vec3f,
};

@vertex
fn vs(
  @location(0) position : vec3f,
  @location(1) normal   : vec3f,
) -> VsOut {
  var out : VsOut;
  let world = u.modelMat * vec4f(position, 1.0);
  out.wpos = world.xyz / world.w;
  out.normal = normalize((u.modelMat * vec4f(normal, 0.0)).xyz);
  out.pos = u.mvpMat * vec4f(position, 1.0);
  return out;
}

fn fresnel(r0 : vec3f, r90 : vec3f, vdoth : f32) -> vec3f {
  return r0 + (r90 - r0) * pow(clamp(1.0 - vdoth, 0.0, 1.0), 5.0);
}

fn occlusion(ndotl : f32, ndotv : f32, ar : f32) -> f32 {
  let aL = 2.0 * ndotl / (ndotl + sqrt(ar * ar + (1.0 - ar * ar) * ndotl * ndotl));
  let aV = 2.0 * ndotv / (ndotv + sqrt(ar * ar + (1.0 - ar * ar) * ndotv * ndotv));
  return aL * aV;
}

fn distribution(ndoth : f32, ar : f32) -> f32 {
  let r2 = ar * ar;
  let f = (ndoth * r2 - ndoth) * ndoth + 1.0;
  return r2 / (PI * f * f);
}

@fragment
fn fs(in : VsOut) -> @location(0) vec4f {
  let perceptualRoughness = clamp(u.metalRough.y, MIN_ROUGHNESS, 1.0);
  let metallic = clamp(u.metalRough.x, 0.0, 1.0);
  let alphaRoughness = perceptualRoughness * perceptualRoughness;

  let baseColor = vec3f(1.0, 1.0, 1.0);
  let f0 = vec3f(0.04);
  let diffuseColor = baseColor * (vec3f(1.0) - f0) * (1.0 - metallic);
  let specularColor = mix(f0, baseColor, metallic);
  let reflectance = max(max(specularColor.r, specularColor.g), specularColor.b);
  let r90 = vec3f(clamp(reflectance * 25.0, 0.0, 1.0));

  let n = normalize(in.normal);
  let v = normalize(u.camera - in.wpos);
  let reflection = -normalize(reflect(v, n));

  // Analytic light contribution (single directional light).
  let l = normalize(u.lightDir);
  let h = normalize(l + v);
  let ndotl = clamp(dot(n, l), 0.001, 1.0);
  let ndotv = clamp(abs(dot(n, v)), 0.001, 1.0);
  let ndoth = clamp(dot(n, h), 0.0, 1.0);
  let vdoth = clamp(dot(v, h), 0.0, 1.0);

  let F = fresnel(specularColor, r90, vdoth);
  let G = occlusion(ndotl, ndotv, alphaRoughness);
  let D = distribution(ndoth, alphaRoughness);
  let diffuseContrib = (1.0 - F) * diffuseColor / PI;
  let specContrib = F * G * D / (4.0 * ndotl * ndotv);
  var color = ndotl * u.lightColor * u.lightStrength * (diffuseContrib + specContrib);

  // Image-based lighting.
  let brdf = textureSample(brdfLUT, samp, vec2f(ndotv, 1.0 - perceptualRoughness)).rgb;
  let diffuseLight = textureSample(diffuseEnv, samp, n).rgb;
  let lod = perceptualRoughness * MIP_COUNT;
  let specularLight = textureSampleLevel(specularEnv, samp, reflection, lod).rgb;
  color += diffuseLight * diffuseColor;
  color += specularLight * (specularColor * brdf.x + brdf.y);

  return vec4f(pow(color, vec3f(1.0 / 2.2)), 1.0);
}
