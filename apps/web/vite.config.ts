import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { frontendAliases } from '../../config/frontend-aliases';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: frontendAliases },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': process.env.API_ORIGIN ?? 'http://127.0.0.1:3001' },
  },
});
