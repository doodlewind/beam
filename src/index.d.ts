export = Beam

declare namespace Beam {
  export enum SchemaTypes {
    vec4 = 'vec4',
    vec3 = 'vec3',
    vec2 = 'vec2',
    int = 'int',
    float = 'float',
    mat4 = 'mat4',
    mat3 = 'mat3',
    mat2 = 'mat2',
    tex2D = 'tex2D',
    texCube = 'texCube',
  }

  export enum ResourceTypes {
    VertexBuffers = 'VertexBuffers',
    IndexBuffer = 'IndexBuffer',
    Textures = 'Textures',
    Uniforms = 'Uniforms',
  }

  export enum GLTypes {
    Triangles = 'Triangles',
    Lines = 'Lines',
    Repeat = 'Repeat',
    MirroredRepeat = 'MirroredRepeat',
    ClampToEdge = 'ClampToEdge',
    Nearest = 'Nearest',
    Linear = 'Linear',
    NearestMipmapNearest = 'NearestMipmapNearest',
    LinearMipmapNearest = 'LinearMipmapNearest',
    NearestMipmapLinear = 'NearestMipmapLinear',
    LinearMipmapLinear = 'LinearMipmapLinear',
    RGB = 'RGB',
    RGBA = 'RGBA',
    SRGB = 'SRGB',
  }

  type UniformValue =
    | number
    | number[]
    | Float32Array
    | Float64Array
    | Uint8Array
    | Uint16Array
    | Uint32Array
    | Int8Array
    | Int16Array
    | Int32Array

  type VertexBufferValue = number[] | Float32Array

  interface ShaderBuffersTemplate {
    [key: string]: {
      type: SchemaTypes
      default?: VertexBufferValue
      n?: number
    }
  }

  interface ShaderUniformsTemplate {
    [key: string]: {
      type: SchemaTypes
      default?: UniformValue
    }
  }

  interface ShaderTexturesTemplate {
    [key: string]: {
      type: SchemaTypes
      default?: any
    }
  }

  interface VertexBufferResourceState {
    [key: string]: VertexBufferValue
  }

  interface IndexBufferResourceState {
    array: number[] | Uint16Array | Uint32Array
    offset?: number
    count?: number
  }

  interface TextureState {
    image?: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
    /** @default false */
    flip?: boolean
    /** @default GLTypes.Repeat */
    wrapS?: GLTypes.Repeat | GLTypes.MirroredRepeat | GLTypes.ClampToEdge
    /** @default GLTypes.Repeat */
    wrapT?: GLTypes.Repeat | GLTypes.MirroredRepeat | GLTypes.ClampToEdge
    /** @default GLTypes.Linear */
    magFilter?: GLTypes.Linear | GLTypes.Nearest
    /** @default GLTypes.Linear */
    minFilter?:
      | GLTypes.Linear
      | GLTypes.Nearest
      | GLTypes.LinearMipmapNearest
      | GLTypes.NearestMipmapLinear
      | GLTypes.LinearMipmapLinear
    /** @default GLTypes.RGBA */
    space?: GLTypes.RGB | GLTypes.RGBA | GLTypes.SRGB
  }

  interface TexturesResourceState {
    [key: string]: TextureState
  }

  interface UniformsResourceState {
    [key: string]: UniformValue
  }

  export class Beam {
    constructor(
      canvas: HTMLCanvasElement,
      config?: {
        contextAttributes?: object
        extensions?: string[]
        contextId?: 'webgl' | 'webgl2'
      }
    )

    clear(color?: [number, number, number, number]): this

    shader<
      B extends ShaderBuffersTemplate,
      U extends ShaderUniformsTemplate,
      T extends ShaderTexturesTemplate
    >(shaderTemplate: {
      vs: string
      fs: string
      buffers?: B
      uniforms?: U
      textures?: T
      mode?: GLTypes
    }): Shader<B, U, T>

    resource<S extends VertexBufferResourceState>(
      type: 'VertexBuffers',
      state: S
    ): VertexBuffersResource<S>

    resource<S extends IndexBufferResourceState>(
      type: 'IndexBuffer',
      state: S
    ): IndexBufferResource<S>

    resource<S extends TexturesResourceState>(
      type: 'Textures',
      state: TexturesResourceState
    ): TexturesResource<S>

    resource<S extends UniformsResourceState>(
      type: 'Uniforms',
      state: S
    ): UniformsResource<S>

    target(width: number, height: number, depth?: boolean): OffscreenTarget

    draw(shader: Shader, ...resources: DrawableResource[]): this
  }

  interface Shader<
    B extends ShaderBuffersTemplate = {},
    U extends ShaderUniformsTemplate = {},
    T extends ShaderTexturesTemplate = {}
  > {
    beam: Beam
    schema: {
      buffers: B
      uniforms: U
      textures: T
      mode: GLTypes.Triangles | GLTypes.Lines
    }
    shaderRefs: {
      program: WebGLProgram
      attributes: {
        [key: string]: {
          type: SchemaTypes
          location: number
        }
      }
      uniforms: {
        [key: string]: {
          type: SchemaTypes
          location: number
        }
      }
    }
  }

  interface Resource<T = '', S = {}> {
    type: T
    state: S
  }

  interface OffscreenTarget {
    state: {
      width: number
      height: number
      depth: boolean
    }

    use(drawCallback: Function): void
  }

  interface VertexBuffersResource<S = {}> extends Resource<'VertexBuffers', S> {
    set(key: string, val: VertexBufferValue): this
    destroy(key: string): void
  }

  interface IndexBufferResource<S = {}> extends Resource<'IndexBuffer', S> {
    set(state: IndexBufferResourceState): this
    destroy(): void
  }

  interface UniformsResource<S = {}> extends Resource<'Uniforms', S> {
    set(key: string, val: UniformValue): this
  }

  interface TexturesResource<S = {}> extends Resource<'Textures', S> {
    set(key: string, val: TextureState): this
    destroy(key: string): void
  }

  type DrawableResource =
    | VertexBuffersResource
    | IndexBufferResource
    | UniformsResource
    | TexturesResource
}
