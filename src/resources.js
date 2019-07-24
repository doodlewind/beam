import { ResourceTypes } from './consts.js'

export const createResource = (gl, type, state) => {
  const Types = ResourceTypes
  class Resource { constructor (state) { this.state = state } }

  class DataBuffersResource extends Resource {
    constructor (state) {
      super(state)
      this.type = Types.DataBuffers
      this.buffers = {}
      const bufferKeys = Object.keys(state)
      bufferKeys.forEach(key => {
        const buffer = gl.createBuffer()
        const data = state[key] instanceof Float32Array
          ? state[key] : new Float32Array(state[key])
        this.buffers[key] = buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
      })
    }
  }

  class IndexBufferResource extends Resource {
    constructor (state) {
      super(state)
      this.type = Types.IndexBuffer
      const { array, offset = 0, count = state.array.length } = state
      this.offset = offset
      this.count = count

      this.buffer = gl.createBuffer()

      const data = array instanceof Uint32Array
        ? array : new Uint32Array(array)
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buffer)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW)
    }
  }

  class UniformsResource extends Resource {
    constructor (state) {
      super(state)
      this.type = Types.Uniforms
      // Use plugin as its key, unsynced uniform keys as its value
      this.unsyncedMap = new Map()
    }

    set (key, val) {
      this.unsyncedMap.forEach(keys => {
        if (!keys.includes(key)) keys.push(key)
      })
      this.state[key] = val
    }
  }

  class TexturesResource extends Resource {
    constructor (state) {
      super(state)
      this.type = Types.Textures
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
