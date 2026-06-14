import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { defineConfig } from 'vite'

const root = dirname(fileURLToPath(import.meta.url))
const pagesDir = resolve(root, 'pages')

// Discover every pages/<category>/<example>/index.html as an MPA entry.
function discoverPages(): Record<string, string> {
  const input: Record<string, string> = { main: resolve(root, 'index.html') }
  if (!existsSync(pagesDir)) return input
  for (const category of readdirSync(pagesDir)) {
    const catDir = resolve(pagesDir, category)
    if (!statSync(catDir).isDirectory()) continue
    for (const example of readdirSync(catDir)) {
      const html = resolve(catDir, example, 'index.html')
      if (existsSync(html)) input[`${category}-${example}`] = html
    }
  }
  return input
}

export default defineConfig(({ command }) => ({
  // On GitHub Pages the examples are served under /beam/play/; in dev, at root.
  base: command === 'build' ? '/beam/play/' : '/',
  // Allow importing .wgsl as raw strings.
  assetsInclude: ['**/*.wgsl'],
  build: {
    target: 'es2022',
    rollupOptions: { input: discoverPages() },
  },
}))
