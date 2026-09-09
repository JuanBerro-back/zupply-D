import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: 'http://192.168.1.65:4000', changeOrigin: true },
      '/socket.io': { target: 'http://192.168.1.65:4000', ws: true },
    },
  },
});