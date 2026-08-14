import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // `vercel dev` used to serve the SPA and the functions together. Now
    // the API is a plain Express process (`npm start`, port 8080), so the
    // dev server forwards /api to it instead.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});
