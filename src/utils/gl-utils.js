import { SchemaTypes, GLTypes } from '../consts.js'
import * as miscUtils from './misc-utils.js'

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
    str + `#define ${key} ${defines[key]}\n`
  ), '')

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, defineStr + vs)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, defineStr + fs)

  const shaderProgram = gl.createProgram()
  gl.attachShader(shaderProgram, vertexShader)
  gl.attachShader(shaderProgram, fragmentShader)
  gl.linkProgram(shaderProgram)

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Failed to init program', gl.getProgramInfoLog(shaderProgram))
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

const padDefault = (schema, key, val) => {
  return val !== undefined ? val : schema.uniforms[key].default
}

export const draw = (gl, plugin, dataBuffers, indexResource, uniforms) => {
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
  const { buffer, count, offset } = indexResource
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer)

  let unit = -1
  Object.keys(shaderRefs.uniforms).forEach(key => {
    const { type, location } = shaderRefs.uniforms[key]
    const val = padDefault(schema, key, uniforms[key])
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
        const texture = null // TOOD
        if (!texture) console.warn(`Missing texture ${key} at unit ${unit}`)
        gl.uniform1i(location, unit)
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, texture)
      },
      [SchemaTypes.texCube]: () => {
        unit++
        const texture = null // TOOD
        if (!texture) console.warn(`Missing texture ${key} at unit ${unit}`)
        gl.uniform1i(location, unit)
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture)
      }
    }
    // With unsynced optimization, we can only update uniforms you provided.
    // If a key is padded by default, it should always be re-uploaded.
    if (val !== undefined) uniformSetterMapping[type]()
  })

  const drawMode = schema.mode === GLTypes.triangles ? gl.TRIANGLES : gl.LINES

  gl.drawElements(drawMode, count, gl.UNSIGNED_INT, offset * 4)
}
