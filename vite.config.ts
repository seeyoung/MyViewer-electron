import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'src/main/index.ts',
        vite: {
          resolve: {
            alias: {
              '@main': path.resolve(__dirname, './src/main'),
              '@shared': path.resolve(__dirname, './src/shared'),
              '@lib': path.resolve(__dirname, './src/lib'),
            },
          },
          build: {
            outDir: 'dist/main',
            lib: {
              entry: 'src/main/index.ts',
              formats: ['cjs'],
            },
            rollupOptions: {
              external: ['electron', 'better-sqlite3', 'sharp', 'yauzl', 'node-7z'],
            },
            copyPublicDir: false,
            assetsInlineLimit: 0,
          },
          publicDir: false,
        },
      },
      preload: {
        input: 'src/main/preload.ts',
        vite: {
          resolve: {
            alias: {
              '@main': path.resolve(__dirname, './src/main'),
              '@shared': path.resolve(__dirname, './src/shared'),
              '@lib': path.resolve(__dirname, './src/lib'),
            },
          },
          build: {
            outDir: 'dist/main',
          },
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, './src/main'),
      '@renderer': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
});
