import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import BeamCanvas from './BeamCanvas.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('BeamCanvas', BeamCanvas)
  }
} satisfies Theme
