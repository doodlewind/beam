import * as glUtils from './utils/gl-utils.js'

export class OffscreenTarget {
  constructor(beam, width, height, depth = false) {
    const { gl } = beam
    this.beam = beam
    this.state = {
      width: width !== undefined ? width : gl.canvas.width,
      height: height !== undefined ? height : gl.canvas.height,
      depth,
    }
    this._init()
  }

  get texture() {
    return this.state.depth ? this.depthTexture : this.colorTexture
  }

  resize(width, height) {
    const { beam, state } = this
    if (width === state.width && height === state.height) return

    glUtils.resetOffscren(beam.gl, this)
    state.width = width
    state.height = height
    this._init()
    return this
  }

  _init() {
    const { fbo, rbo, colorTexture, depthTexture } = glUtils.initOffscreen(
      this.beam.gl,
      this.state
    )
    this.fbo = fbo
    this.rbo = rbo
    this.colorTexture = colorTexture
    this.depthTexture = depthTexture
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
