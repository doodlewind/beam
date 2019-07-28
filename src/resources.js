import { ResourceTypes } from './consts.js'
import * as glUtils from './utils/gl-utils.js'

export const createResource = (gl, type, state) => {
  const Types = ResourceTypes
  class Resource {
    constructor () { this.state = state; this.type = type }
    set (key, val) { this.state[key] = val; return this }
  }

  class DataBuffersResource extends Resource {
    constructor () {
      super()
      this.buffers = glUtils.initDataBuffers(gl, state)
    }
  }

  class IndexBufferResource extends Resource {
    constructor () {
      super()
      const { offset = 0, count = state.array.length } = state
      this.state.offset = offset
      this.state.count = count
      this.buffer = glUtils.initIndexBuffer(gl, state)
    }
  }

  class UniformsResource extends Resource {}

  class TexturesResource extends Resource {
    constructor () {
      super()
      this.textures = glUtils.initTextures(gl, state)
    }

    set (key, val) {
      this.state[key] = val // FIXME should sync image texture
      if (val.texture) this.textures[key] = val.texture
      return this
    }
  }

  class OffscreenResource extends Resource {
    constructor () {
      super()
      const { size = 2048 } = this.state
      this.state.size = size
      const { fbo, rbo, texture } = glUtils.initOffscreen(gl, state)
      this.fbo = fbo
      this.rbo = rbo
      this.texture = texture
    }
  }

  const resourceCreatorMap = {
    [Types.DataBuffers]: () => new DataBuffersResource(),
    [Types.IndexBuffer]: () => new IndexBufferResource(),
    [Types.Uniforms]: () => new UniformsResource(),
    [Types.Textures]: () => new TexturesResource(),
    [Types.Offscreen]: () => new OffscreenResource()
  }
  return resourceCreatorMap[type]()
}
