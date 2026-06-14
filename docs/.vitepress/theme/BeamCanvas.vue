<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, shallowRef } from 'vue'

// A client-only live-demo host. It renders a <canvas> and, once mounted in the
// browser, hands a real Beam device + canvas to your `setup` function. Nothing
// WebGPU touches the server: the import and run happen inside onMounted only, so
// VitePress SSR/build stays safe. If the browser lacks navigator.gpu we show a
// graceful message instead of throwing.
//
// `setup` receives ({ beam, canvas }) where `beam` is an initialized Beam device
// (await Beam.gpu(canvas) already done). It may return a cleanup function — e.g.
// the `stop` from beam.loop(...) — which we call on unmount.

interface SetupCtx {
  beam: any
  canvas: HTMLCanvasElement
}
type Cleanup = void | (() => void)
type SetupFn = (ctx: SetupCtx) => Cleanup | Promise<Cleanup>

const props = withDefaults(
  defineProps<{
    setup: SetupFn
    width?: number
    height?: number
  }>(),
  { width: 400, height: 400 }
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const error = ref<string | null>(null)
const cleanup = shallowRef<(() => void) | null>(null)
let beam: any = null

onMounted(async () => {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    error.value =
      'WebGPU is not available in this browser. Try the latest Chrome, Edge, or Safari.'
    return
  }
  const canvas = canvasRef.value
  if (!canvas) return

  try {
    const { Beam } = await import('beam-gpu')
    canvas.width = props.width
    canvas.height = props.height
    beam = await Beam.gpu(canvas)
    const ret = await props.setup({ beam, canvas })
    if (typeof ret === 'function') cleanup.value = ret
  } catch (err: any) {
    error.value = err?.message ?? String(err)
  }
})

onBeforeUnmount(() => {
  try {
    cleanup.value?.()
  } catch {}
  try {
    beam?.destroy?.()
  } catch {}
})
</script>

<template>
  <div class="beam-canvas">
    <canvas
      v-show="!error"
      ref="canvasRef"
      :style="{ width: width + 'px', height: height + 'px' }"
    />
    <p v-if="error" class="beam-canvas__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.beam-canvas {
  display: flex;
  justify-content: center;
  margin: 1.25rem 0;
}
.beam-canvas canvas {
  max-width: 100%;
  border-radius: 8px;
  background: #000;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}
.beam-canvas__error {
  padding: 1rem 1.25rem;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  text-align: center;
}
</style>
