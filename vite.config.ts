import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // The API is a separate Express process in dev (`npm start`, port
    // 8080), so the Vite dev server forwards /api to it.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
