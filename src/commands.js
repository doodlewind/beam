/**
 * @param {WebGLRenderingContext} gl
 * @param {*} resource
 */
const beforeWithColor = (gl, resource) => {
  const { state, colorTexture, fbo, rbo } = resource
  const { width, height } = state

  gl.viewport(0, 0, width, height)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.bindRenderbuffer(gl.RENDERBUFFER, rbo)
  gl.renderbufferStorage(
    gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height
  )
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0
  )

  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.DEPTH_STENCIL_ATTACHMENT,
    gl.TEXTURE_2D,
    null,
    0
  )
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.TEXTURE_2D,
    null,
    0
  )
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.STENCIL_ATTACHMENT,
    gl.TEXTURE_2D,
    null,
    0
  )

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
}

const beforeWithDepth = (gl, resource) => {
  const { state, fbo } = resource
  const { size } = state
  gl.viewport(0, 0, size, size)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.clear(gl.DEPTH_BUFFER_BIT)
}

export const Offscreen2DCommand = {
  name: 'offscreen2D',
  onBefore (gl, resource) {
    const { depth } = resource.state
    depth ? beforeWithDepth(gl, resource) : beforeWithColor(gl, resource)
  },
  onAfter (gl) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
  }
}
