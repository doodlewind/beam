import { lookAt, ortho } from '../../utils/mat4.js'

export const createShadowCamera = (eye, center, size) => {
  const viewMat = lookAt([], eye, center, [0, 1, 0])
  const aspect = 1
  const projectionMat = ortho(
    [], -size * aspect, size * aspect, -size, size, 0.1, 100
  )
  return { viewMat, projectionMat }
}
