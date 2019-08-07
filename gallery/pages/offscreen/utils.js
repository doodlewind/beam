import { lookAt, ortho } from '../../utils/mat4.js'

export const initOffscreen = (gl, state) => {
  const { size } = state

  const fbo = gl.createFramebuffer()
  const rbo = null
  const colorTexture = gl.createTexture()
  const depthTexture = gl.createTexture()

  gl.bindTexture(gl.TEXTURE_2D, colorTexture)
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null
  )

  gl.bindTexture(gl.TEXTURE_2D, depthTexture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.DEPTH_COMPONENT,
    size,
    size,
    0,
    gl.DEPTH_COMPONENT,
    gl.UNSIGNED_SHORT,
    null
  )

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0
  )
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0
  )

  const e = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
  if (e !== gl.FRAMEBUFFER_COMPLETE) {
    console.error('framebuffer not complete', e.toString())
  }

  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  return { fbo, rbo, colorTexture, depthTexture }
}

export const Offscreen2DCommand = {
  name: 'offscreen2D',
  onBefore (gl, resource) {
    const { state, fbo } = resource
    const { size } = state
    gl.viewport(0, 0, size, size)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.clear(gl.DEPTH_BUFFER_BIT)
  },
  onAfter (gl) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight)
  }
}

export const createShadowCamera = (eye, center, size) => {
  const viewMat = lookAt([], eye, center, [0, 1, 0])
  const aspect = 1
  const projectionMat = ortho(
    [], -size * aspect, size * aspect, -size, size, 0.1, 100
  )
  return { viewMat, projectionMat }
}
