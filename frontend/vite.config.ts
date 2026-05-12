import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // Project page path – used for ALL asset URLs in the production build.
  // Dev server stays at '/' so the Vite proxy keeps working normally.
  base: command === 'build' ? '/supplier-collaboration/' : '/',
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
}));
