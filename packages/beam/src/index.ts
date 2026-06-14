// ============================================================================
// Public entry. Exports the Beam device class (named + default) and re-exports
// the full locked type surface so consumers import everything from one place.
// ============================================================================

export const VERSION = '0.3.0'

export { Beam } from './beam'
export { Beam as default } from './beam'

export type * from './types'
