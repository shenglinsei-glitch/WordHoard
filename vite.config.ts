import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // GitHub Pages（https://<user>.github.io/WordHoard/）用
  base: '/WordHoard/',

  // ✅ npm run build の出力先を dist ではなく docs にする（GitHub Pages の /docs 配信に対応）
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
        start_url: '/WordHoard/',
        scope: '/WordHoard/',
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
