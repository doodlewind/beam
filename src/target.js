import * as glUtils from './utils/gl-utils.js'

export class OffscreenTarget {
  constructor(beam, width, height, depth) {
    const { gl } = beam
    this.beam = beam
    this.state = {
      width: Number.isInteger(width) ? width : gl.canvas.width,
      height: Number.isInteger(height) ? height : gl.canvas.height,
      depth,
    }

    const { fbo, rbo, colorTexture, depthTexture } = glUtils.initOffscreen(
      gl,
      this.state
    )
    this.fbo = fbo
    this.rbo = rbo
    this.colorTexture = colorTexture
    this.depthTexture = depthTexture
  }

  get texture() {
    return this.state.depth ? this.depthTexture : this.colorTexture
  }

  // FIXME reset FBO state
  setSize(width, height) {
    this.state.width = width
    this.state.height = height
    return this
  }

  _before() {
    const { gl } = this.beam
    this._viewport = gl.getParameter(gl.VIEWPORT)
    this.state.depth
      ? glUtils.beforeDrawToDepth(this.beam.gl, this)
      : glUtils.beforeDrawToColor(this.beam.gl, this)
  }

  _after() {
    const { gl } = this.beam
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(...this._viewport)
  }

  use(drawCallback = () => {}) {
    this._before()
    drawCallback()
    this._after()
  }
}
