import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    // `npm run dev:lan` → HTTPS on your local IP so phones allow vibration/wake lock
    mode === 'lan' && basicSsl(),
    VitePWA({
      registerType: 'autoUpdate', // new deploy = new version on next app start
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'High Noon Duel',
        short_name: 'Duel',
        description: 'Western duel prototype for a uni study',
        display: 'fullscreen', // no browser UI, no status bar
        orientation: 'landscape', // held sideways like a pistol, barrel to the left
        start_url: '/',
        scope: '/',
        background_color: '#2b1a10',
        theme_color: '#2b1a10',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,mp3,wav,ogg,woff2}'], // cache app, images, sounds, font
        navigateFallback: '/index.html',
      },
      devOptions: {
        enabled: false, // flip to true to test the SW in `npm run dev`
      },
    }),
  ],
}))
