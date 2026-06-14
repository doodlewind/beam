<script setup lang="ts">
import { withBase } from 'vitepress'

// Links into the separate examples app, which is deployed under <base>/play/.
// `withBase` applies the site base correctly; `target="_blank"` makes the
// browser do a real navigation instead of VitePress SPA routing (which would
// 404, since /play/ is not a docs route).
const props = defineProps<{ to: string }>()
const href = withBase(`/play/pages/${props.to}/`)
</script>

<template>
  <a :href="href" target="_blank" rel="noopener"><slot /></a>
</template>
