import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  css: {
    postcss: './postcss.config.js'
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  }
});
