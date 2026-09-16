import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { evisBackendPlugin } from './server/evisBackendPlugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    evisBackendPlugin(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ''),
        timeout: 120000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if ((err as any).code === 'ECONNREFUSED' && res && 'writeHead' in res && !res.headersSent) {
              (res as any).writeHead(503, { 'Content-Type': 'application/json' });
              (res as any).end(JSON.stringify({ error: 'Ollama offline' }));
            }
          });
        },
      },
      '/llama-cpp': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/llama-cpp/, ''),
        timeout: 120000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            if ((err as any).code === 'ECONNREFUSED' && res && 'writeHead' in res && !res.headersSent) {
              (res as any).writeHead(503, { 'Content-Type': 'application/json' });
              (res as any).end(JSON.stringify({ error: 'llama.cpp offline' }));
            }
          });
        },
      },
    },
  },
});
