import {defineConfig} from 'vitest/config';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        dts({
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.test.ts'],
            rollupTypes: true,
        }),
    ],
    build: {
        lib: {
            entry: 'src/index.ts',
            formats: ['es'],
            fileName: 'football-core',
        },
        minify: false,
    },
    test: {
        include: ['src/**/*.test.ts'],
    },
});
