import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';

// The version lives in package.json. The build writes it, with the commit Render is
// building, to /version.json, which the NEC Suite and the app read to see updates.
const { version } = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const versionJson = () => JSON.stringify({ name: 'TMS Driver', version, commit: String(process.env.RENDER_GIT_COMMIT || '').slice(0, 7) });
const versionFile = {
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: versionJson() });
  },
  configureServer(server) {
    server.middlewares.use('/version.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(versionJson());
    });
  },
};

// Locally the TMS server runs on port 3001 (npm run dev in the TMS repository).
// Set TMS_SERVER to point the dev server somewhere else.
export default defineConfig({
  plugins: [react(), versionFile],
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: {
    port: 5174,
    proxy: { '/api': process.env.TMS_SERVER || 'http://localhost:3001' },
  },
  preview: { port: 4174 },
  test: { environment: 'node' },
});
