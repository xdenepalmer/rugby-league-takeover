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
  ],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          const normalized = id.replace(/\\/g, '/')
          if (normalized.includes('/node_modules/react/') || normalized.includes('/node_modules/react-dom/') || normalized.includes('/node_modules/react-router-dom/')) {
            return 'vendor-react'
          }
          if (normalized.includes('/node_modules/@base44/') || normalized.includes('/node_modules/axios/')) {
            return 'vendor-base44'
          }
          if (normalized.includes('/node_modules/@tanstack/react-query/')) {
            return 'vendor-query'
          }
          if (normalized.includes('/node_modules/framer-motion/') || normalized.includes('/node_modules/motion-dom/') || normalized.includes('/node_modules/motion-utils/')) {
            return 'vendor-motion'
          }
          if (normalized.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons'
          }
          if (normalized.includes('/node_modules/recharts/') || normalized.includes('/node_modules/d3-') || normalized.includes('/node_modules/victory-vendor/')) {
            return 'vendor-charts'
          }
          if (normalized.includes('/node_modules/date-fns/')) {
            return 'vendor-date'
          }
          if (
            normalized.includes('/node_modules/@radix-ui/') ||
            normalized.includes('/node_modules/cmdk/') ||
            normalized.includes('/node_modules/vaul/') ||
            normalized.includes('/node_modules/input-otp/') ||
            normalized.includes('/node_modules/embla-carousel-react/') ||
            normalized.includes('/node_modules/react-day-picker/')
          ) {
            return 'vendor-ui'
          }

          return 'vendor-misc'
        },
      },
    },
  },
});
