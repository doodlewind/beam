# Beam
Expressive WebGL

## Introduction
Beam is a tiny WebGL library. It's **NOT** a renderer or 3D engine by itself. Instead, Beam provides some essential abstractions, allowing you to build WebGL infrastructures within a very small and easy-to-use API surface.

The WebGL API is known to be verbose, with a steep learning curve. Just like how jQuery simplifies DOM operations, Beam wraps WebGL in a succinct way, making it easier to build WebGL renderers with clean and terse code.

How is this possible? Instead of just reorganizing boilerplate code, Beam defines some essential concepts on top of WebGL, which can be much easier to be understood and used. These highly simplified concepts include:

* **Shaders** - Objects containing graphics algorithms. In contrast of JavaScript that only runs on CPU with a single thread, shaders are run in parallel on GPU, computing colors for millions of pixels every frame.
* **Resources** - Objects containing graphics data. Just like how JSON works in your web app, resources are the data passed to shaders, which mainly includes triangle arrays (aka buffers), image textures, and global options.
* **Draw** - Requests for running shaders with resources. To render a scene, different shaders and resources may be used. You are free to combine them, so as to fire multi draw calls that eventually compose a frame. In fact, each draw call will start the graphics render pipeline for once.
* **Commands** - Setups before firing a draw call. WebGL is *very* stateful. Before every draw call, WebGL states must be carefully configured. These changes are indicated via commands. Beam makes use of conventions that greatly reduces manual command maintenance. Certainly you can also define and run custom commands easily.

Since commands can be mostly automated, there are only 3 concepts for beginners to learn, represented by 3 core APIs in Beam. They are**beam.shader**, **beam.resource** and **beam.draw**. Conceptually only with these 3 methods, you can build a WebGL app.

## Installation
``` bash
npm install beam-gl
```

Or you can clone this repository and start a static HTTP server to try it out. Beam runs directly in modern browser, without any need to build or compile.

## Hello World with Beam
Now we are going to write a simplest WebGL app with Beam, which renders a colorful triangle:

![beam-hello-world](./gallery/assets/images/beam-hello-world.png)

Here is the code snippet:

``` js
import { Beam, ResourceTypes } from 'beam-gl'
import { MyShader } from './my-shader.js' // checkout later
const { VertexBuffers, IndexBuffer } = ResourceTypes

// Remember to create a `<canvas>` element in HTML
const canvas = document.querySelector('canvas')
// Init Beam instance
const beam = new Beam(canvas)

// Init shader for triangle rendering
const shader = beam.shader(MyShader)

// Init vertex buffer resource
const vertexBuffers = beam.resource(VertexBuffers, {
  position: [
    -1, -1, 0, // vertex 0, bottom left
    0, 1, 0, // vertex 1, top middle
    1, -1, 0 // vertex 2, bottom right
  ],
  color: [
    1, 0, 0, // vertex 0, red
    0, 1, 0, // vertex 1, green
    0, 0, 1 // vertex 2, blue
  ]
})
// Init index buffer resource with 3 indices
const indexBuffer = beam.resource(IndexBuffer, {
  array: [0, 1, 2]
})

// Clear the screen, then draw with shader and resources
beam
  .clear()
  .draw(shader, vertexBuffers, indexBuffer)
```

Now let's take a look at some pieces of code in this example. Firstly we need to init Beam instance with a canvas:

``` js
const canvas = document.querySelector('canvas')
const beam = new Beam(canvas)
```

Then we can init a shader with `beam.shader`. The content in `MyShader` will be explained later:

``` js
const shader = beam.shader(MyShader)
```

For the triangle, use the `beam.resource` API to create its data, which is contained in different buffers. Beam use the `VertexBuffers` type to represent them. There are 3 vertices in the triangle, each vertex has two attributes, which is **position** and **color**. Every vertex attribute has its vertex buffer, which can be declared as a flat and plain JavaScript array (or TypedArray). Beam will upload these data to GPU behind the scene:

``` js
const vertexBuffers = beam.resource(VertexBuffers, {
  position: [
    -1, -1, 0, // vertex 0, bottom left
    0, 1, 0, // vertex 1, top middle
    1, -1, 0 // vertex 2, bottom right
  ],
  color: [
    1, 0, 0, // vertex 0, red
    0, 1, 0, // vertex 1, green
    0, 0, 1 // vertex 2, blue
  ]
})
```

Vertex buffers usually contain a compact dataset. We can define a subset or superset of which to render, so that we can reduce redundancy and reuse more vertices. To do that we need to introduce another type of buffer called `IndexBuffer`, which contains indices of the vertices in `vertexBuffers`:

``` js
const indexBuffer = beam.resource(IndexBuffer, {
  array: [0, 1, 2]
})
```

> In this example, each index refers to 3 spaces in the vertex array.

Finally we can render with WebGL. `beam.clear` can clear the frame, then the chainable `beam.draw` can draw with **one shader object and multi resource objects**:

``` js
beam
  .clear()
  .draw(shader, vertexBuffers, indexBuffer)
```

The `beam.draw` API is flexible, if you have multi shaders and resources, just combine them to make draw calls at your wish, composing a complex scene:

``` js
beam
  .draw(shaderX, ...resourcesA)
  .draw(shaderY, ...resourcesB)
  .draw(shaderZ, ...resourcesC)
```

There's one missing point: How to decide the render algorithm of the triangle? This is done in the `MyShader` variable, which is a schema of the shader object, and it looks like this:

``` js
import { SchemaTypes } from 'beam-gl'

const vertexShader = `
attribute vec4 position;
attribute vec4 color;
varying highp vec4 vColor;
void main() {
  vColor = color;
  gl_Position = position;
}
`
const fragmentShader = `
varying highp vec4 vColor;
void main() {
  gl_FragColor = vColor;
}
`

const { vec4 } = SchemaTypes
export const MyShader = {
  vs: vertexShader,
  fs: fragmentShader,
  buffers: {
    position: { type: vec4, n: 3 },
    color: { type: vec4, n: 3 }
  }
}
```

This shows a simple shader schema in Beam, which is made of a string for vertex shader, a string for fragment shader, and other schema fields. From a very brief view, vertex shader is executed once per vertex, and fragment shader is executed once per pixel. They are written in the GLSL shader language. In WebGL, the vertex shader always writes to `gl_Position` as its output, and the fragment shader writes to  `gl_FragColor` for final pixel color. The `vColor` varying variable is interpolated and passed from vertex shader to fragment shader, and the `position` and `color` vertex attribute variables, are corresponding to the buffer keys in `vertexBuffers`. That's a convention to simplify boilerplates.

## Examples
See [Beam Examples](./examples.html) for versatile WebGL snippets based on Beam, including:

* Render multi 3D objects
* Mesh loading
* Texture config
* Classic lighting
* Physically based rendering (PBR)
* Chainable Image Filters
* Offscreen rendering (using FBO)
* Shadow mapping
* Basic articles
* WebGL extension config
* Customize your renderers

## License
MIT
