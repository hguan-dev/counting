import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/counting/',
  plugins: [
    react(),
    // Precache the whole build (app, fonts, card faces, icons) so the table
    // works offline after one online visit. The new service worker takes over
    // on the next launch rather than reloading the page mid-hand.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        // The alternate face cards and jokers are never dealt and make up
        // most of the card folder's size.
        globIgnores: ['vite.svg', 'cards/*2.svg', 'cards/*joker.svg'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    globals: true,
  },
})
