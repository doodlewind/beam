export const Offscreen2DCommand = {
  name: 'offscreen2D',
  onBefore (gl, resource) {
    const { state, texture, fbo, rbo } = resource
    const { size } = state

    gl.viewport(0, 0, size, size)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.bindRenderbuffer(gl.RENDERBUFFER, rbo)
    gl.renderbufferStorage(
      gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size
    )
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0
    )
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  },
  onAfter (gl) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, gl.canvas.clientWidth, gl.canvas.clientHeight)
  }
}
