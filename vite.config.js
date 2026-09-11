import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  optimizeDeps: {
    exclude: ['three'],
  },
});
