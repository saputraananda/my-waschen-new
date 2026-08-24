import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 7000,
    proxy: {
      '/api': {
        target: 'http://localhost:7001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:7001',
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
