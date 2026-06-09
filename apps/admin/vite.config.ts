import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/v1': { target: 'http://localhost:3005', changeOrigin: true },
        [`${base.replace(/\/$/, '')}/v1`]: {
          target: 'http://localhost:3005',
          changeOrigin: true,
          rewrite: (path) => path.replace(new RegExp(`^${base.replace(/\/$/, '')}/v1`), '/v1'),
        },
      },
    },
  };
});
