import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import BeamCanvas from './BeamCanvas.vue'
import PlayLink from './PlayLink.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('BeamCanvas', BeamCanvas)
    app.component('PlayLink', PlayLink)
  }
} satisfies Theme
