import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'waschen.webp',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'splash-2048x2732.png',
        'splash-2732x2048.png',
        'splash-1668x2388.png',
        'splash-2388x1668.png',
        'splash-1640x2360.png',
        'splash-2360x1640.png'
      ],
      manifest: {
        name: 'Waschen Laundry',
        short_name: 'Waschen',
        description: 'Aplikasi Waschen Laundry Alora Indonesia',
        theme_color: '#5f1340',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    host: true,
    port: 7000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  esbuild: {
    supported: {
      'destructuring': true,
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      supported: {
        'destructuring': true,
      },
    },
  },
});
