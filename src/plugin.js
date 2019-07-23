import { GLTypes } from './consts.js'
import * as glUtils from './utils/gl-utils.js'

export class ShadePlugin {
  constructor (beam, pluginTemplate) {
    this.beam = beam

    const {
      buffers = {},
      uniforms = {},
      textures = {},
      mode = GLTypes.triangles
    } = pluginTemplate
    this.schema = { buffers, uniforms, textures, mode }

    const { vs, fs, defines = {} } = pluginTemplate
    this.shaderRefs = glUtils.initShaderRefs(
      beam.gl, defines, this.schema, vs, fs
    )

    // Set value to true if a uniform resource is used and uploaded
    this.uniformResourceMap = new WeakMap()
  }

  set ({ vs, fs, defines }) {

  }
}
