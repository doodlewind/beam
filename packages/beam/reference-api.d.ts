// ============================================================================
// beam-gpu — AUTHORITATIVE public type surface (the locked contract).
// The implementation in src/ MUST match these signatures exactly.
// This file is reference documentation, not part of the build.
// ============================================================================

// ---- Schema vocabulary (heir to old SchemaTypes) ----------------------------
export type Scalar = 'f32' | 'i32' | 'u32'
export type VecType = 'vec2' | 'vec3' | 'vec4'
export type MatType = 'mat2' | 'mat3' | 'mat4'
export type NumType = Scalar | VecType | MatType
export type TexType = 'tex2d' | 'texCube' | 'texDepth'
export type SampType = 'sampler' | 'samplerNonFilter' | 'samplerCompare'

/** The JS value the user supplies / infers for a numeric schema field. */
export type ValueOf<T extends NumType> = T extends Scalar
  ? number
  : number[] | Float32Array

export type VertexSchema = Record<string, VecType | Scalar>
export type UniformSchema = Record<string, NumType>
export type TextureSchema = Record<string, TexType>
export type SamplerSchema = Record<string, SampType>

// ---- Device config + factory ------------------------------------------------
export interface BeamConfig {
  format?: GPUTextureFormat
  alpha?: 'opaque' | 'premultiplied'
  depth?: boolean
  hidpi?: boolean
  power?: GPUPowerPreference
  features?: GPUFeatureName[]
  limits?: Record<string, number>
  device?: GPUDevice
}

// ---- Fixed-function presets -------------------------------------------------
export type Primitive = 'tri' | 'tri-strip' | 'line' | 'point'
export type Cull = 'none' | 'back' | 'front'
export type Blend = 'none' | 'alpha' | 'add'

export interface DepthOpts {
  test?: boolean
  write?: boolean
  compare?: GPUCompareFunction
  format?: GPUTextureFormat
}
export interface ColorTarget {
  format?: GPUTextureFormat
  blend?: Blend
}

// ---- Pipeline template (heir to beam.shader) --------------------------------
export interface PipelineTemplate<
  V extends VertexSchema = VertexSchema,
  U extends UniformSchema = {},
  T extends TextureSchema = {},
  S extends SamplerSchema = {}
> {
  wgsl: string
  vertex: V
  uniforms?: U
  textures?: T
  samplers?: S
  vsEntry?: string
  fsEntry?: string
  primitive?: Primitive
  cull?: Cull
  depth?: boolean | DepthOpts
  blend?: Blend
  targets?: ColorTarget[]
  samples?: 1 | 4
  constants?: Record<string, number | boolean>
  label?: string
}

// ---- Resource value shapes --------------------------------------------------
export type VertsState<V extends VertexSchema> = {
  [K in keyof V]: number[] | Float32Array
}
export type UniformState<U extends UniformSchema> = {
  [K in keyof U]?: ValueOf<U[K]>
}

export interface IndexState {
  array: number[] | Uint16Array | Uint32Array
  count?: number
  offset?: number
}

export type TextureSource =
  | ImageBitmap
  | HTMLImageElement
  | HTMLCanvasElement
  | HTMLVideoElement
  | { data: BufferSource; width: number; height: number }
export type CubeFaces = [
  TextureSource,
  TextureSource,
  TextureSource,
  TextureSource,
  TextureSource,
  TextureSource
]

export type Wrap = 'repeat' | 'mirror' | 'clamp'
export type Filter = 'nearest' | 'linear'

export interface TextureOpts {
  format?: GPUTextureFormat
  srgb?: boolean
  flipY?: boolean
  mips?: boolean
  usage?: GPUTextureUsageFlags
  label?: string
}
export interface SamplerOpts {
  wrap?: Wrap | [Wrap, Wrap] | [Wrap, Wrap, Wrap]
  mag?: Filter
  min?: Filter
  mip?: Filter
  compare?: GPUCompareFunction
}

// ---- Resources (mutable GPU objects; .set returns this) ---------------------
export interface Verts<V extends VertexSchema = VertexSchema> {
  readonly kind: 'verts'
  set<K extends keyof V>(key: K, value: number[] | Float32Array): this
  set(state: Partial<VertsState<V>>): this
  readonly count: number
  readonly buffers: Record<keyof V & string, GPUBuffer>
  destroy(): void
}
export interface Index {
  readonly kind: 'index'
  set(state: IndexState): this
  readonly count: number
  readonly offset: number
  readonly format: GPUIndexFormat
  readonly buffer: GPUBuffer
  destroy(): void
}
export interface Uniforms<U extends UniformSchema = {}> {
  readonly kind: 'uniforms'
  set<K extends keyof U>(key: K, value: ValueOf<U[K]>): this
  set(key: string, value: number | number[] | Float32Array): this
  set(state: UniformState<U>): this
  readonly buffer: GPUBuffer
  destroy(): void
}
export interface Texture {
  readonly kind: 'texture'
  set(source: TextureSource | CubeFaces, opts?: TextureOpts): this
  readonly gpu: GPUTexture
  readonly view: GPUTextureView
  readonly cube: boolean
  destroy(): void
}
export interface Sampler {
  readonly kind: 'sampler'
  readonly gpu: GPUSampler
}

// ---- Pipeline ---------------------------------------------------------------
export interface Pipeline<
  V extends VertexSchema = VertexSchema,
  U extends UniformSchema = {},
  T extends TextureSchema = {},
  S extends SamplerSchema = {}
> {
  readonly gpu: GPURenderPipeline
  readonly schema: { vertex: V; uniforms: U; textures: T; samplers: S }
  group(i: number): BindLayout
}

// ---- Bind groups (power path) -----------------------------------------------
export type BindResource =
  | Uniforms
  | Texture
  | Sampler
  | GPUBuffer
  | GPUTextureView
  | GPUSampler
export type BindEntries = Record<number, BindResource>
export interface BindLayout {
  readonly gpu: GPUBindGroupLayout
  readonly index: number
}
export interface BindGroup {
  readonly gpu: GPUBindGroup
  readonly index: number
}

// ---- Bindings: keyed data for one draw --------------------------------------
export interface Bindings<
  V extends VertexSchema = VertexSchema,
  U extends UniformSchema = {},
  T extends TextureSchema = {},
  S extends SamplerSchema = {}
> {
  verts: Verts<V>
  index?: Index
  uniforms?: Uniforms<U>
  textures?: { [K in keyof T]: Texture }
  samplers?: { [K in keyof S]: Sampler }
  instances?: number
  groups?: BindGroup[]
}

// ---- Target (offscreen RTT) -------------------------------------------------
export interface TargetOpts {
  width: number
  height: number
  depth?: boolean
  format?: GPUTextureFormat
  samples?: 1 | 4
  label?: string
}
export interface Target {
  readonly width: number
  readonly height: number
  readonly color: Texture
  readonly depth?: Texture
  clear(color?: [number, number, number, number], depth?: number): this
  draw<
    V extends VertexSchema,
    U extends UniformSchema,
    T extends TextureSchema,
    S extends SamplerSchema
  >(
    pipeline: Pipeline<V, U, T, S>,
    bindings: Bindings<V, U, T, S>
  ): this
  resize(width: number, height: number): void
  destroy(): void
}

// ---- Pass (power path) ------------------------------------------------------
export interface PassOpts {
  target?: Target
  clear?: [number, number, number, number] | null
  clearDepth?: number | null
  encoder?: GPUCommandEncoder
}
export interface Pass {
  readonly gpu: GPURenderPassEncoder
  readonly encoder: GPUCommandEncoder
  clear(color?: [number, number, number, number], depth?: number): this
  draw(pipeline: Pipeline, bindings: Bindings): this
  viewport(x: number, y: number, w: number, h: number): this
  scissor(x: number, y: number, w: number, h: number): this
  end(): this
  submit(): void
}

// ---- The device -------------------------------------------------------------
export declare class Beam {
  static gpu(canvas: HTMLCanvasElement, config?: BeamConfig): Promise<Beam>
  static create(canvas: HTMLCanvasElement, config?: BeamConfig): Promise<Beam>

  readonly device: GPUDevice
  readonly adapter: GPUAdapter
  readonly ctx: GPUCanvasContext
  readonly format: GPUTextureFormat
  readonly canvas: HTMLCanvasElement

  pipeline<
    V extends VertexSchema,
    U extends UniformSchema = {},
    T extends TextureSchema = {},
    S extends SamplerSchema = {}
  >(
    template: PipelineTemplate<V, U, T, S>
  ): Pipeline<V, U, T, S>

  verts<V extends VertexSchema>(schema: V, state?: Partial<VertsState<V>>): Verts<V>
  index(state: IndexState): Index
  uniforms<U extends UniformSchema>(schema: U, state?: UniformState<U>): Uniforms<U>
  texture(source?: TextureSource, opts?: TextureOpts): Texture
  cube(faces?: CubeFaces, opts?: TextureOpts): Texture
  sampler(opts?: SamplerOpts): Sampler

  bind(layout: BindLayout, entries: BindEntries): BindGroup
  target(opts: TargetOpts): Target

  clear(color?: [number, number, number, number], depth?: number): this
  draw<
    V extends VertexSchema,
    U extends UniformSchema,
    T extends TextureSchema,
    S extends SamplerSchema
  >(
    pipeline: Pipeline<V, U, T, S>,
    bindings: Bindings<V, U, T, S>
  ): this

  pass(opts?: PassOpts): Pass
  frame(cb: (t: number) => void): void
  loop(cb: (t: number, dt: number) => void): () => void
  resize(width?: number, height?: number): void
  destroy(): void
}

export default Beam
