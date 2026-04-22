import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Replaces __BUILD_TIME__ in the copied dist/sw.js with the actual timestamp
// so each build produces a unique SW file byte-sequence that the browser detects.
function swBuildTimePlugin() {
  return {
    name: 'sw-build-time',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist/sw.js')
      try {
        let content = readFileSync(swPath, 'utf-8')
        content = content.replace("'__BUILD_TIME__'", `'${Date.now()}'`)
        writeFileSync(swPath, content)
      } catch {
        // sw.js not present (e.g. running vite build --watch); safe to ignore
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), swBuildTimePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
