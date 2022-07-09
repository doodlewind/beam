import { SchemaTypes, ResourceTypes } from '../consts.js'

export const isPowerOf2 = (value) => (value & (value - 1)) === 0

export const mapValue = (obj, valueMapper) =>
  Object.keys(obj).reduce(
    (newObj, key) => ({ ...newObj, [key]: valueMapper(obj, key) }),
    {}
  )

export const getNumComponents = (bufferType) => {
  const { vec2, vec3, vec4, float } = SchemaTypes
  const mapping = { [vec2]: 2, [vec3]: 3, [vec4]: 4, [float]: 1 }
  return mapping[bufferType]
}

export const groupResources = (resources) => {
  const Types = ResourceTypes
  let [vertexBuffers, indexResource, uniforms, textures] = [{}, null, {}, {}]

  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i]
    const { type } = resource

    if (type === Types.VertexBuffers) {
      vertexBuffers = { ...vertexBuffers, ...resource.buffers }
    } else if (type === Types.IndexBuffer) {
      indexResource = resource
    } else if (type === Types.Uniforms) {
      uniforms = { ...uniforms, ...resource.state }
    } else if (type === Types.Textures) {
      textures = { ...textures, ...resource.textures }
    }
  }

  return [vertexBuffers, indexResource, uniforms, textures]
}
