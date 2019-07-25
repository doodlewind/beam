import { ResourceTypes } from './consts.js'
import { isPowerOf2 } from './utils/misc-utils.js'

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
    }

    set (key, val) {
      this.state[key] = val
      return this
    }
  }

  class TexturesResource extends Resource {
    constructor (state) {
      super(state)
      this.type = Types.Textures
      this.textures = {}

      Object.keys(state).forEach(key => {
        const texture = gl.createTexture()
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        const space = gl.RGBA

        const { flip, image, repeat } = state[key]
        if (flip) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, space, space, gl.UNSIGNED_BYTE, image)

        if (
          image && isPowerOf2(image.width) && isPowerOf2(image.height) &&
          image.nodeName !== 'VIDEO'
        ) {
          gl.generateMipmap(gl.TEXTURE_2D)
          if (!repeat) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
          }
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        }
        this.textures[key] = texture
      })
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
