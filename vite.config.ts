import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// GitHub Pages serves the site from /<repo-name>/. The deploy workflow passes
// that path in BASE_PATH; local dev and tests run from the root.
const base = `${(process.env.BASE_PATH ?? '').replace(/\/$/, '')}/`

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registered in src/lib/updates.ts, which also reloads into new versions.
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Flashcards',
        short_name: 'Flashcards',
        description: 'Spaced-repetition flashcards for language vocabulary.',
        lang: 'en',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        theme_color: '#1d4f91',
        background_color: '#f6f5f1',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // A new version takes over as soon as it's downloaded; updates.ts then reloads into it.
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
        runtimeCaching: [
          {
            // Optional per-card recordings in public/audio/
            urlPattern: ({ url }) => url.pathname.includes('/audio/'),
            handler: 'CacheFirst',
            options: { cacheName: 'card-audio', expiration: { maxEntries: 2000 } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The persistent module cache doesn't notice new files in decks/, so a just-added deck would go unvalidated.
    fsModuleCache: false,
  },
})
