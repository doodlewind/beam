import { SchemaTypes, ResourceTypes } from '../consts.js'

export const mapValue = (obj, valueMapper) => Object
  .keys(obj)
  .reduce((newObj, key) => ({ ...newObj, [key]: valueMapper(obj, key) }), {})

export const getNumComponents = bufferType => {
  const { vec2, vec3, vec4, float } = SchemaTypes
  const mapping = { [vec2]: 2, [vec3]: 3, [vec4]: 4, [float]: 1 }
  return mapping[bufferType]
}

const getUnsyncedUniforms = (plugin, resource) => {
  const { state } = resource
  const unsyncedKeys = resource.unsyncedMap.get(plugin) || Object.keys(state)
  return unsyncedKeys.reduce((obj, key) => ({ ...obj, [key]: state[key] }), {})
}

export const groupResources = (plugin, resources) => {
  const Types = ResourceTypes
  let [dataBuffers, indexResource, uniforms] = [{}, null, {}]

  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i]
    const { type } = resource

    if (type === Types.DataBuffers) {
      dataBuffers = { ...dataBuffers, ...resource.buffers }
    } else if (type === Types.IndexBuffer) {
      indexResource = resource
    } else if (type === Types.Uniforms) {
      const uploaded = !!plugin.uniformResourceMap.get(resource)
      uploaded
        ? uniforms = { ...uniforms, ...getUnsyncedUniforms(plugin, resource) }
        : uniforms = { ...uniforms, ...resource.state }

      resource.unsyncedMap.set(plugin, [])
    }
  }

  return [dataBuffers, indexResource, uniforms]
}

export const updatePluginResourceMap = (plugin, resources) => {
  const Types = ResourceTypes
  const { uniformResourceMap } = plugin
  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i]
    const { type } = resource
    if (type === Types.Uniforms && !uniformResourceMap.get(resource)) {
      uniformResourceMap.set(resource, true)
    }
  }
}
