import { lookAt, perspective, type Mat4, type Vec3 } from './mat4'

export interface Camera {
  viewMat: Mat4
  projectionMat: Mat4
}

export const createCamera = (
  viewArgs: { eye?: Vec3; center?: Vec3; up?: Vec3 } = {},
  perspectiveArgs: {
    canvas?: { width?: number; height?: number }
    fov?: number
    zNear?: number
    zFar?: number
  } = {}
): Camera => {
  const { eye = [0, 0, 0], center = [0, 0, 0], up = [0, 1, 0] } = viewArgs
  const {
    canvas = {},
    fov = Math.PI / 6,
    zNear = 0.1,
    zFar = 1000,
  } = perspectiveArgs
  const aspect = (canvas.width || 1) / (canvas.height || 1)
  return {
    viewMat: lookAt(new Float32Array(16), eye, center, up),
    projectionMat: perspective(new Float32Array(16), fov, aspect, zNear, zFar),
  }
}
