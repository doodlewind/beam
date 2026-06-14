import { SchemaTypes } from '../../src/index.js'

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

void main() {
  vec4 texColor = texture2D(img, vTexCoord);
  gl_FragColor = texColor;
}
`

const { vec2, vec4, float, tex2D } = SchemaTypes

export const BasicImage = {
  vs: defaultVS,
  fs: defaultFS,
  buffers: {
    position: { type: vec4, n: 3 },
    texCoord: { type: vec2 }
  },
  textures: {
    img: { type: tex2D }
  }
}

const brighnessContrastFS = `
precision highp float;
uniform sampler2D img;
uniform float brightness;
uniform float contrast;

varying highp vec2 vTexCoord;

void main() {
  vec4 color = texture2D(img, vTexCoord);
  color.rgb += brightness;
  if (contrast > 0.0) {
    color.rgb = (color.rgb - 0.5) / (1.0 - contrast) + 0.5;
  } else {
    color.rgb = (color.rgb - 0.5) * (1.0 + contrast) + 0.5;
  }
  gl_FragColor = color;
}
`

export const BrightnessContrast = {
  ...BasicImage,
  fs: brighnessContrastFS,
  uniforms: {
    brightness: { type: float, default: 0 },
    contrast: { type: float, default: 0 }
  }
}

export const hueSaturationFS = `
precision highp float;
uniform sampler2D img;
uniform float hue;
uniform float saturation;

varying vec2 vTexCoord;

void main() {
  vec4 color = texture2D(img, vTexCoord);

  /* hue adjustment, wolfram alpha: RotationTransform[angle, {1, 1, 1}][{x, y, z}] */
  float angle = hue * 3.14159265;
  float s = sin(angle), c = cos(angle);
  vec3 weights = (vec3(2.0 * c, -sqrt(3.0) * s - c, sqrt(3.0) * s - c) + 1.0) / 3.0;
  float len = length(color.rgb);
  color.rgb = vec3(
    dot(color.rgb, weights.xyz),
    dot(color.rgb, weights.zxy),
    dot(color.rgb, weights.yzx)
  );

  /* saturation adjustment */
  float average = (color.r + color.g + color.b) / 3.0;
  if (saturation > 0.0) {
    color.rgb += (average - color.rgb) * (1.0 - 1.0 / (1.001 - saturation));
  } else {
    color.rgb += (average - color.rgb) * (-saturation);
  }
  gl_FragColor = color;
}
`

export const HueSaturation = {
  ...BasicImage,
  fs: hueSaturationFS,
  uniforms: {
    hue: { type: float, default: 0 },
    saturation: { type: float, default: 0 }
  }
}

const vignetteFS = `
precision highp float;
uniform sampler2D img;
uniform float vignette;

varying vec2 vTexCoord;

void main() {
  float innerVig = 1.0 - vignette;
  float outerVig = 1.0001; // Position for the outer vignette
  // float innerVig = 0.4; // Position for the inner vignette ring

  vec3 color = texture2D(img, vTexCoord).rgb;
  vec2 center = vec2(0.5, 0.5); // center of screen
  // Distance between center and the current uv. Multiplyed by 1.414213 to fit in the range of 0.0 to 1.0.
  float dist = distance(center, vTexCoord) * 1.414213;
  // Generate the vignette with clamp which go from outer ring to inner ring with smooth steps.
  float vig = clamp((outerVig - dist) / (outerVig - innerVig), 0.0, 1.0);
  color *= vig; // Multiply the vignette with the texture color
  gl_FragColor = vec4(color, 1.0);
}
`

export const Vignette = {
  ...BasicImage,
  fs: vignetteFS,
  uniforms: {
    vignette: { type: float, default: 0 }
  }
}
