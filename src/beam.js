import { RendererConfig } from './consts.js'
import { ShadePlugin } from './plugin.js'
import { createResource } from './resources.js'
import * as glUtils from './utils/gl-utils.js'
import * as miscUtils from './utils/misc-utils.js'

export class Beam {
  constructor (canvas, config = {}) {
    this.gl = glUtils.getWebGLInstance(canvas)
    this.config = { ...RendererConfig, ...config }
    this.gl.extensions = glUtils.getExtensions(this.gl, this.config)
  }

  clear (color = [0, 0, 0, 0]) {
    glUtils.clear(this.gl, color)
    return this
  }

  draw (plugin, ...resources) {
    const groupedResources = miscUtils.groupResources(resources)
    glUtils.draw(this.gl, plugin, ...groupedResources)
    return this
  }

  plugin (pluginTemplate) {
    const plugin = new ShadePlugin(this, pluginTemplate)
    return plugin
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
