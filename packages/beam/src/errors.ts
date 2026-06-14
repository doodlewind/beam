// ============================================================================
// Labeled error / diagnostic helpers.
// ============================================================================

import type { UniformSchema } from './types'

/**
 * Dev mode flag. Bundlers (Vite/Rollup) statically replace
 * `import.meta.env.PROD`; when absent we default to dev (true).
 */
export const DEV: boolean = !(
  (import.meta as { env?: { PROD?: boolean } }).env?.PROD === true
)

/** Build a labeled Error: `[beam:label] msg`. */
export function beamError(label: string, msg: string): Error {
  return new Error(`[beam:${label}] ${msg}`)
}

/** Dev-only warning, prefixed with the resource label. */
export function beamWarn(label: string, msg: string): void {
  if (DEV) console.warn(`[beam:${label}] ${msg}`)
}

/**
 * Dev-mode validation wrapper: pushes a GPU error scope around `fn`, then pops
 * it and surfaces any validation error as a labeled console error. In
 * production this is a transparent passthrough (no scope, no await cost).
 */
export async function withErrorScope<T>(
  device: GPUDevice,
  label: string,
  fn: () => T
): Promise<T> {
  if (!DEV) return fn()
  device.pushErrorScope('validation')
  const result = fn()
  const error = await device.popErrorScope()
  if (error) console.error(`[beam:${label}] ${error.message}`)
  return result
}

/**
 * Dev warning when a computed std140 UBO size looks wrong (zero, or not a
 * multiple of 16 — the std140 struct stride alignment).
 */
export function assertUniformSize(
  label: string,
  computedSize: number,
  schema: UniformSchema
): void {
  if (!DEV) return
  if (computedSize === 0) {
    if (Object.keys(schema).length > 0) {
      beamWarn(label, 'uniform schema is non-empty but computed UBO size is 0')
    }
    return
  }
  if (computedSize % 16 !== 0) {
    beamWarn(
      label,
      `std140 UBO size ${computedSize} is not a multiple of 16 ` +
        `(struct stride must be 16-aligned)`
    )
  }
}
