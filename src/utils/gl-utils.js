import { SchemaTypes, GLTypes } from '../consts.js'
import * as miscUtils from './misc-utils.js'

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

export const getWebGLInstance = canvas => {
  return canvas.getContext('webgl')
}

export const getExtensions = (gl, config) => {
  const extensions = {}
  config.extensions.forEach(name => {
    extensions[name] = gl.getExtension(name)
  })
  return extensions
}

const compileShader = (gl, type, source) => {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Error compiling shaders', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

const initShader = (gl, defines, vs, fs) => {
  const defineStr = Object.keys(defines).reduce((str, key) => (
    defines[key] ? str + `#define ${key} ${defines[key]}\n` : ''
  ), '')

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, defineStr + vs)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, defineStr + fs)

  const shaderProgram = gl.createProgram()
  gl.attachShader(shaderProgram, vertexShader)
  gl.attachShader(shaderProgram, fragmentShader)
  gl.linkProgram(shaderProgram)

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Error initing program', gl.getProgramInfoLog(shaderProgram))
    return null
  }

  return shaderProgram
}

export const initShaderRefs = (gl, defines, schema, vs, fs) => {
  const program = initShader(gl, defines, vs, fs)
  // map to { pos: { type, location } }
  const attributes = miscUtils.mapValue(schema.buffers, (attributes, key) => ({
    type: attributes[key].type,
    location: gl.getAttribLocation(program, key)
  }))
  const uniforms = miscUtils.mapValue({
    ...schema.uniforms, ...schema.textures
  }, (uniforms, key) => ({
    type: uniforms[key].type,
    location: gl.getUniformLocation(program, key)
  }))

  return { program, attributes, uniforms }
}

export const clear = (gl, color) => {
  const [r, g, b, a] = color
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  gl.clearColor(r, g, b, a)
  gl.clearDepth(1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  gl.enable(gl.DEPTH_TEST)
}

export const initDataBuffers = (gl, state) => {
  const buffers = {}
  const bufferKeys = Object.keys(state)
  bufferKeys.forEach(key => {
    const buffer = gl.createBuffer()
    buffers[key] = buffer
    updateDataBuffer(gl, buffers[key], state[key])
  })
  return buffers
}

export const updateDataBuffer = (gl, buffer, array) => {
  const data = array instanceof Float32Array
    ? array : new Float32Array(array)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
}

export const destroyDataBuffer = (gl, buffer) => {
  gl.deleteBuffer(buffer)
}

export const initIndexBuffer = (gl, state) => {
  const { array } = state
  const buffer = gl.createBuffer()
  updateIndexBuffer(gl, buffer, array)
  return buffer
}

export const updateIndexBuffer = (gl, buffer, array) => {
  const data = array instanceof Uint32Array
    ? array : new Uint32Array(array)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW)
}

export const destroyIndexBuffer = (gl, buffer) => {
  gl.deleteBuffer(buffer)
}

export const init2DTexture = (gl, val) => {
  const texture = gl.createTexture()
  update2DTexture(gl, texture, val)
  return texture
}

export const initCubeTexture = (gl, val) => {
  const texture = gl.createTexture()
  updateCubeTexture(gl, texture, val)
  return texture
}

export const initTextures = (gl, state) => {
  const textures = {}
  Object.keys(state).forEach(key => {
    const texture = state[key].image
      ? init2DTexture(gl, state[key])
      : initCubeTexture(gl, state[key])
    textures[key] = texture
  })

  return textures
}

export const update2DTexture = (gl, texture, val) => {
  const { flip, image, repeat } = val

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)

  const space = gl.RGBA
  if (flip) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, space, space, gl.UNSIGNED_BYTE, image)

  const { isPowerOf2 } = miscUtils
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
  return texture
}

export const updateCubeTexture = (gl, texture, val) => {
  const { level, images, flip } = val

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  if (level < 2) {
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  } else {
    gl.texParameteri(
      gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR
    )
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!flip)

  const faces = [
    gl.TEXTURE_CUBE_MAP_POSITIVE_X,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
    gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
    gl.TEXTURE_CUBE_MAP_NEGATIVE_Z
  ]

  let count = 0
  for (let i = 0; i < faces.length; i++) {
    for (let j = 0; j <= level; j++) {
      const face = faces[i]
      const { extensions } = gl
      const space = !isSafari && extensions.EXT_SRGB
        ? extensions.EXT_SRGB.SRGB_EXT
        : gl.RGBA
      gl.texImage2D(face, j, space, space, gl.UNSIGNED_BYTE, images[count])
      count++
    }
  }
  return texture
}

export const destroyTexture = (gl, texture) => {
  gl.deleteTexture(texture)
}

export const initOffscreen = (gl, state) => {
  const fbo = gl.createFramebuffer()
  const rbo = gl.createRenderbuffer()
  const colorTexture = gl.createTexture()
  const depthTexture = null // TODO

  const { size } = state
  gl.bindTexture(gl.TEXTURE_2D, colorTexture)
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  gl.bindRenderbuffer(gl.RENDERBUFFER, rbo)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size)

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0
  )
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo
  )

  const e = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if (gl.FRAMEBUFFER_COMPLETE !== e) {
    console.error('Frame buffer object is incomplete: ' + e.toString())
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindRenderbuffer(gl.RENDERBUFFER, null)

  return { fbo, rbo, colorTexture, depthTexture }
}

const padDefault = (schema, key, val) => {
  return val !== undefined ? val : schema.uniforms[key].default
}

export const draw = (
  gl, plugin, dataBuffers, indexResource, uniforms, textures
) => {
  const { schema, shaderRefs } = plugin
  gl.useProgram(shaderRefs.program)
  Object.keys(shaderRefs.attributes).forEach(key => {
    if (
      !schema.buffers[key] || schema.buffers[key].type === SchemaTypes.index
    ) return
    const { location } = shaderRefs.attributes[key]
    const { n, type } = schema.buffers[key]
    const numComponents = n || miscUtils.getNumComponents(type)

    gl.bindBuffer(gl.ARRAY_BUFFER, dataBuffers[key])
    gl.vertexAttribPointer(location, numComponents, gl.FLOAT, false, 0, 0)
    gl.enableVertexAttribArray(location)
  })
  const { buffer, state } = indexResource
  const { offset, count } = state
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer)

  let unit = -1
  Object.keys(shaderRefs.uniforms).forEach(key => {
    const { type, location } = shaderRefs.uniforms[key]
    let val
    const isTexure = type === SchemaTypes.tex2D || type === SchemaTypes.texCube
    if (!isTexure) {
      val = padDefault(schema, key, uniforms[key])
    }

    const uniformSetterMapping = {
      [SchemaTypes.vec4]: () => gl.uniform4fv(location, val),
      [SchemaTypes.vec3]: () => gl.uniform3fv(location, val),
      [SchemaTypes.vec2]: () => gl.uniform2fv(location, val),
      [SchemaTypes.int]: () => {
        !val || typeof val === 'number' || typeof val === 'string'
          ? gl.uniform1i(location, val)
          : gl.uniform1iv(location, val)
      },
      [SchemaTypes.float]: () => {
        !val || typeof val === 'number' || typeof val === 'string'
          ? gl.uniform1f(location, val)
          : gl.uniform1fv(location, val)
      },
      [SchemaTypes.mat4]: () => gl.uniformMatrix4fv(location, false, val),
      [SchemaTypes.mat3]: () => gl.uniformMatrix3fv(location, false, val),
      [SchemaTypes.mat2]: () => gl.uniformMatrix2fv(location, false, val),
      [SchemaTypes.tex2D]: () => {
        unit++
        const texture = textures[key]
        if (!texture) console.warn(`Missing texture ${key} at unit ${unit}`)
        gl.uniform1i(location, unit)
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, texture)
      },
      [SchemaTypes.texCube]: () => {
        unit++
        const texture = textures[key]
        if (!texture) console.warn(`Missing texture ${key} at unit ${unit}`)
        gl.uniform1i(location, unit)
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
      }
    }
    // FIXME uniform keys padded by default are always re-uploaded.
    if (val !== undefined || isTexure) uniformSetterMapping[type]()
  })

  const drawMode = schema.mode === GLTypes.Triangles ? gl.TRIANGLES : gl.LINES
  gl.drawElements(drawMode, count, gl.UNSIGNED_INT, offset * 4)
}
