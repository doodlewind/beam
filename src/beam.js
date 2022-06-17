import { RendererConfig } from './consts.js'
import { Shader } from './shader.js'
import { createResource } from './resources.js'
import * as glUtils from './utils/gl-utils.js'
import * as miscUtils from './utils/misc-utils.js'
import { Offscreen2DCommand } from './commands.js'

export class Beam {
  constructor (canvas, config = {}) {
    this.gl = glUtils.getWebGLInstance(canvas, config.contextAttributes)
    this.config = { ...RendererConfig, ...config }
    this.gl.extensions = glUtils.getExtensions(this.gl, this.config)
    this.define(Offscreen2DCommand)
  }

  clear (color = [0, 0, 0, 0]) {
    glUtils.clear(this.gl, color)
    return this
  }

  draw (shader, ...resources) {
    const groupedResources = miscUtils.groupResources(resources)
    glUtils.draw(this.gl, shader, ...groupedResources)
    return this
  }

  shader (shaderTemplate) {
    const shader = new Shader(this, shaderTemplate)
    return shader
  }

  resource (type, state = {}) {
    return createResource(this.gl, type, state)
  }

  define ({ name, onBefore, onAfter }) {
    this[name] = (arg, modifier = () => {}) => {
      if (onBefore) onBefore(this.gl, arg)
      modifier(arg)
      if (onAfter) onAfter(this.gl, arg)
      return this
    }
  }
}
