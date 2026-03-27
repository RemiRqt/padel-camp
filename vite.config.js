import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Inject build timestamp into service worker for cache busting
function swVersionPlugin() {
  return {
    name: 'sw-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CACHE_VERSION = '${Date.now()}';\n` +
          require('fs').readFileSync('public/sw.js', 'utf-8').replace(/const CACHE_NAME = .*/, `const CACHE_NAME = 'padel-camp-' + CACHE_VERSION`),
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), swVersionPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
