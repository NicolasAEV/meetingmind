import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

// External packages that must NOT be bundled in the main-process build.
// Native packages (onnxruntime-node inside @xenova/transformers) are loaded
// at runtime from node_modules by Electron's Node.js.
const mainExternals = [
  'electron',
  '@xenova/transformers',
  'ollama',
  'electron-store',
  'uuid',
  'date-fns',
]

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // ── Main process ──────────────────────────────────────────────────
        entry: 'electron/main/index.ts',
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron',
            rollupOptions: { external: mainExternals },
          },
        },
      },
      {
        // ── Preload script ────────────────────────────────────────────────
        entry: 'electron/preload/index.ts',
        onstart(options) {
          // Notify renderer to reload after preload rebuild
          options.reload()
        },
        vite: {
          build: {
            sourcemap: 'inline',
            minify: false,
            outDir: 'dist-electron',
            rollupOptions: { 
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'preload.cjs'
              }
            },
          },
        },
      },
    ]),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
