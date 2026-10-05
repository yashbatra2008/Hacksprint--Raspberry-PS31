import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT) > 0 ? Number(process.env.WEB_PORT) : 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 5174}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
