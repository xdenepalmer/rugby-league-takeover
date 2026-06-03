import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { visualizer } from 'rollup-plugin-visualizer'

// Stamp the built service worker with a unique id per build. This makes sw.js
// byte-different on every publish, so the browser's update check reliably detects
// a new version and the in-app update prompt can offer a reload.
const BUILD_ID = String(Date.now())
function stampServiceWorker() {
  return {
    name: 'rlt-stamp-sw',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir || resolve(process.cwd(), 'dist')
      const swPath = resolve(outDir, 'sw.js')
      if (!existsSync(swPath)) return
      const stamped = readFileSync(swPath, 'utf8').replace(/__BUILD_ID__/g, BUILD_ID)
      writeFileSync(swPath, stamped)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  define: {
    // Available to the app (e.g. to display the running version).
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID),
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
    stampServiceWorker(),
    visualizer({
      filename: 'dist/stats.html',
      title: 'Rugby League Takeover Bundle Visualizer',
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  ]
});
