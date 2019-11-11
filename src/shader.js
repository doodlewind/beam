import { GLTypes } from './consts.js'
import * as glUtils from './utils/gl-utils.js'

export class Shader {
  constructor (beam, shaderTemplate) {
    this.beam = beam

    const {
      buffers = {},
      uniforms = {},
      textures = {},
      mode = GLTypes.Triangles
    } = shaderTemplate
    this.schema = { buffers, uniforms, textures, mode }

    const { vs, fs, defines = {} } = shaderTemplate
    this.shaderRefs = glUtils.initShaderRefs(
      beam.gl, defines, this.schema, vs, fs
    )
  }

  set ({ vs, fs, defines }) {

  }
}
