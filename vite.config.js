import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Locally the TMS server runs on port 3001 (npm run dev in the TMS repository).
// Set TMS_SERVER to point the dev server somewhere else.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { '/api': process.env.TMS_SERVER || 'http://localhost:3001' },
  },
  preview: { port: 4174 },
  test: { environment: 'node' },
});
