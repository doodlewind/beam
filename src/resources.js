import { ResourceTypes } from './consts.js'
import * as glUtils from './utils/gl-utils.js'

export const createResource = (gl, type, state) => {
  const Types = ResourceTypes
  class Resource {
    constructor (state) { this.state = state; this.type = type }
  }

  class DataBuffersResource extends Resource {
    constructor (state) {
      super(state)
      this.buffers = glUtils.initDataBuffers(gl, state)
    }
  }

  class IndexBufferResource extends Resource {
    constructor (state) {
      super(state)
      const { offset = 0, count = state.array.length } = state
      this.offset = offset
      this.count = count
      this.buffer = glUtils.initIndexBuffer(gl, state)
    }
  }

  class UniformsResource extends Resource {
    set (key, val) {
      this.state[key] = val
      return this
    }
  }

  class TexturesResource extends Resource {
    constructor (state) {
      super(state)
      this.textures = glUtils.initTextures(gl, state)
    }
  }

  const resourceCreatorMap = {
    [Types.DataBuffers]: () => new DataBuffersResource(state),
    [Types.IndexBuffer]: () => new IndexBufferResource(state),
    [Types.Uniforms]: () => new UniformsResource(state),
    [Types.Textures]: () => new TexturesResource(state)
  }
  return resourceCreatorMap[type]()
}
