import { Beam } from './beam.js'

export class BeamRenderer {
  constructor (canvas) { this.beam = new Beam(canvas) }
  render () { this.beam.clear() }
}
