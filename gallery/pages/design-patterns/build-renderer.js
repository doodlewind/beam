// Build your renderer to fully encapsulate Beam and WebGL
import { MeshRenderer } from './mesh-renderer.js'

const canvas = document.querySelector('canvas')
const renderer = new MeshRenderer(canvas)
// renderer.wireframe = false // Try commenting this out!

const ball = renderer.BallMesh()
renderer.add(ball)
renderer.setCamera([5, 5, 5])
renderer.render()
