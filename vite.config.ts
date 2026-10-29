import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt' statt 'autoUpdate': Die App meldet eine neue Fassung und
      // lädt erst auf Klick neu. Registriert wird in src/lib/pwa-update.ts,
      // deshalb kein eingefügtes Skript.
      registerType: 'prompt',
      injectRegister: false,
      // App-Shell + Assets werden gecacht; API-Daten bewusst nicht
      // (Free-Tier-Strategie: offline reicht die Shell).
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/downloads\//],
      },
      manifest: {
        name: 'OmniDesk',
        short_name: 'OmniDesk',
        description:
          'Modulare All-in-One-Produktivitäts-Schaltzentrale für IT-Profis',
        lang: 'de',
        display: 'standalone',
        start_url: '/',
        theme_color: '#09090b',
        background_color: '#09090b',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Lokale Entwicklung: API-Server (npm run dev:api) auf Port 8787
      '/api': 'http://localhost:8787',
    },
  },
})
