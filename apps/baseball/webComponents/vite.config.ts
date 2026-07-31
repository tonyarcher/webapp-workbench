import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'BaseballWebComponents',
      fileName: () => 'web-components.js',
      formats: ['iife']
    },
    outDir: resolve(__dirname, '../webApp/src/wasmJsMain/resources/js'),
    emptyOutDir: false
  }
});
