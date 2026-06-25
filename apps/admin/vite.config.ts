import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repoRoot, '');
  const base = env.VITE_BASE_PATH || '/';
  const apiPort = env.API_PORT || '3905';
  const adminPort = Number(env.ADMIN_PORT || 3907);

  return {
    base,
    envDir: repoRoot,
    plugins: [react()],
    server: {
      port: adminPort,
      proxy: {
        '/v1': { target: `http://localhost:${apiPort}`, changeOrigin: true },
        [`${base.replace(/\/$/, '')}/v1`]: {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${base.replace(/\/$/, '')}/v1`), '/v1'),
        },
      },
    },
  };
});
