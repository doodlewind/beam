import { lookAt, perspective } from './mat4.js'

export const createCamera = (viewArgs = {}, perspectiveArgs = {}) => {
  const { eye = [0, 0, 0], center = [0, 0, 0], up = [0, 1, 0] } = viewArgs
  const {
    canvas = {}, fov = Math.PI / 6, zNear = 0.1, zFar = 1000
  } = perspectiveArgs
  const aspect = (canvas.width || 1) / (canvas.height || 1)

  return {
    viewMat: lookAt([], eye, center, up),
    projectionMat: perspective([], fov, aspect, zNear, zFar)
  }
}
