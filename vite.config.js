import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `npm run dev` (scripts/dev.js) picks a free API port and exports it here.
const apiPort = process.env.API_PORT || process.env.PORT || 5002;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 6002,
    proxy: {
      '/api': {
        // 127.0.0.1 avoids "localhost" resolving to ::1 vs 127.0.0.1 mismatches.
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
        configure: (proxy) => {
          // Replace Vite's default (empty 500) with a clear JSON 503 that the
          // frontend can show and auto-retry.
          proxy.removeAllListeners('error');
          proxy.on('error', (err, req, res) => {
            console.error(`[proxy] ${req.method} ${req.url} -> API on port ${apiPort} unreachable (${err.code || err.message})`);
            if (res && typeof res.writeHead === 'function' && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '2' });
              res.end(JSON.stringify({
                status: 'error',
                message: 'API server is starting or unreachable. Retrying...',
              }));
            }
          });
        },
      },
    },
  },
});
