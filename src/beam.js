import { RendererConfig } from './consts.js'
import { Shader } from './shader.js'
import { OffscreenTarget } from './target.js'
import { createResource } from './resources.js'
import * as glUtils from './utils/gl-utils.js'
import * as miscUtils from './utils/misc-utils.js'

export class Beam {
  constructor(canvas, config = {}) {
    this.gl = glUtils.getWebGLInstance(canvas, config)
    this.config = { ...RendererConfig, ...config }
    this.gl.extensions = glUtils.getExtensions(this.gl, this.config)
  }

  clear(color = [0, 0, 0, 0]) {
    glUtils.clear(this.gl, color)
    return this
  }

  draw(shader, ...resources) {
    const groupedResources = miscUtils.groupResources(resources)
    glUtils.draw(this.gl, shader, ...groupedResources)
    return this
  }

  shader(shaderTemplate) {
    const shader = new Shader(this, shaderTemplate)
    return shader
  }

  resource(type, state = {}) {
    return createResource(this.gl, type, state)
  }

  target(width, height, depth = false) {
    const offscreenTarget = new OffscreenTarget(this, width, height, depth)
    return offscreenTarget
  }
}
