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
    texCube = 'texCube'
  }

  export enum ResourceTypes {
    VertexBuffers = 'VertexBuffers',
    IndexBuffer = 'IndexBuffer',
    Uniforms = 'Uniforms',
    Textures = 'Textures',
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
    SRGB = 'SRGB'
  }

  type Buffers = {
    [key: string]: {
      type: SchemaTypes;
      default?: any;
      n?: number;
    }
  }

  type Uniforms = {
    [key: string]: {
      type: SchemaTypes;
      default?: any;
    }
  }

  type Textures = {
    [key: string]: {
      type: SchemaTypes;
      default?: any;
    }
  }

  export class Beam {
    constructor(canvas: HTMLCanvasElement, config?: {
      contextAttributes: object;
      extensions: string[];
    })

    clear(color?: [Number, Number, Number, Number]): this

    shader<B extends Buffers, U extends Uniforms, T extends Textures>(shaderTemplate: {
      vs: string,
      fs: string,
      buffers?: B,
      uniforms?: U,
      textures?: T,
      mode?: GLTypes
    }): Shader<B, U, T>

    target(width: number, height: number, depth?: boolean): OffscreenTarget

    draw(shader: Shader, ...resources: DrawableResource[]): this

    resource<T extends ResourceTypes, S extends object = {}>(type: T, state?: S): (
      T extends ResourceTypes.VertexBuffers ? VertexBuffersResource<S> :
      T extends ResourceTypes.IndexBuffer ? IndexBufferResource<S> :
      T extends ResourceTypes.Textures ? TexturesResource<S> :
      T extends ResourceTypes.Uniforms ? UniformsResource<S> :
      never
    )
  }

  interface Shader<B extends Buffers = {}, U extends Uniforms = {}, T extends Textures = {}> {
    beam: Beam
    schema: {
      buffers: B,
      uniforms: U,
      textures: T,
      mode: GLTypes
    }
    shaderRefs: {
      program: WebGLProgram,
      attributes: {
        [key: string]: {
          type: SchemaTypes,
          location: number
        }
      },
      uniforms: {
        [key: string]: {
          type: SchemaTypes,
          location: number
        }
      }
    }
  }

  interface Resource<T = '', S = {}> {
    type: T
    state: S
    set<K extends keyof S>(key: K | string, val: any): this
    set(state: Partial<S> | any): this
  }

  interface OffscreenTarget {
    state: {
      width: number,
      height: number,
      depth: boolean
    }

    use(drawCallback: Function): void
  }

  interface VertexBuffersResource<S = {}> extends Resource<ResourceTypes.VertexBuffers, S> {
    destroy(): void
  }

  interface IndexBufferResource<S = {}> extends Resource<ResourceTypes.IndexBuffer, S> {
    destroy(): void
  }

  interface UniformsResource<S = {}> extends Resource<ResourceTypes.Uniforms, S> { }

  interface TexturesResource<S = {}> extends Resource<ResourceTypes.Textures, S> {
    destroy(): void
  }

  type DrawableResource =
    | VertexBuffersResource
    | IndexBufferResource
    | UniformsResource
    | TexturesResource
}
