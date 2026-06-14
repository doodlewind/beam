import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Beam',
      formats: ['es'],
      fileName: () => 'beam-gpu.js',
    },
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
