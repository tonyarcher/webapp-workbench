import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

// https://vite.dev/config/
export default defineConfig({
  base: process.env.APP_BASE_PATH ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
