/// <reference types="vite/client" />
/// <reference types="@webgpu/types" />

declare module '*.wgsl' {
  const src: string
  export default src
}

declare module '*.wgsl?raw' {
  const src: string
  export default src
}
