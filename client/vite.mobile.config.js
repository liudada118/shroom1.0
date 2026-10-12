import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));

// 移动 WebView 离线入口；输出由 build-mobile-display 脚本内联进 RN 包。
export default defineConfig({
  root: clientRoot,
  base: './',
  publicDir: false,
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  resolve: {
    dedupe: ['react', 'react-dom', 'three'],
    alias: { '@shroom/frontend': path.resolve(clientRoot, '../sdk/frontend') },
  },
  build: {
    outDir: path.join(os.tmpdir(), 'shroom-mobile-display'),
    emptyOutDir: true,
    target: 'es2018',
    sourcemap: false,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    lib: {
      entry: path.join(clientRoot, 'src/mobile/main.jsx'),
      name: 'ShroomMobileDisplay',
      formats: ['iife'],
      fileName: () => 'display.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
    chunkSizeWarningLimit: 2500,
  },
});
