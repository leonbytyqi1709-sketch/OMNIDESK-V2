import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
/**
 * Kennung dieses Baustands. Produktiv der Commit, lokal die Bauzeit. Sie
 * steht sowohl im Code (`__APP_BUILD__`) als auch in `/version.json`; weichen
 * beide voneinander ab, läuft im Browser eine veraltete Fassung.
 */
const buildId = (
  process.env.VERCEL_GIT_COMMIT_SHA ?? `lokal-${Date.now()}`
).slice(0, 12)

/** Schreibt die Kennung als eigene Datei neben die Anwendung. */
const versionFile = {
  name: 'omnidesk-version-file',
  generateBundle(this: { emitFile: (file: Record<string, unknown>) => void }) {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ build: buildId }),
    })
  },
}

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(buildId) },
  plugins: [
    versionFile,
    react(),
    tailwindcss(),
    VitePWA({
      // 'autoUpdate': Ein neuer Service Worker übernimmt sofort und wartet
      // nie. 'prompt' hatte am 29.10.2026 eine Sackgasse erzeugt – der neue
      // Worker wartete auf ein Signal, das nur die neue Oberfläche senden
      // kann, die der Browser wegen des alten Workers gar nicht bekam.
      // Ob neu geladen wird, entscheidet die Baustand-Prüfung in
      // src/lib/pwa-update.ts; dort wird auch registriert.
      registerType: 'autoUpdate',
      injectRegister: false,
      // App-Shell + Assets werden gecacht; API-Daten bewusst nicht
      // (Free-Tier-Strategie: offline reicht die Shell).
      workbox: {
        // Ausdrücklich, nicht nur über registerType: Ein neuer Worker
        // übernimmt sofort und wartet nicht auf das Schließen aller Tabs.
        skipWaiting: true,
        clientsClaim: true,
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
