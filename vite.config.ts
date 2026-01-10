import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/jici/',

  // ✅ npm run build の出力先を dist ではなく docs にする（GitHub Pages 用）
  build: {
    outDir: 'docs',
    emptyOutDir: true,
  },

  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '积词',
        short_name: '积词',
        start_url: '/jici/',
        scope: '/jici/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#53BEE8',
        icons: [
          { src: '/jici/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/jici/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
})
