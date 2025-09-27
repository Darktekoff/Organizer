import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['better-sqlite3', 'sqlite3', 'electron'],
      input: {
        main: 'src/main/main.ts'
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'hash-worker') {
            return 'workers/[name].js';
          }
          return '[name].js';
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared')
    }
  }
});
