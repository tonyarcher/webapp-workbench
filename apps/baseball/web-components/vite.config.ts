import {defineConfig} from 'vite';
import {resolve} from 'path';
import {readdirSync, statSync} from 'fs';
import dts from 'vite-plugin-dts';

// Automatically discover separate entry points for your multi-component setup
const getComponentEntries = (): Record<string, string> => {
    const componentsPath = resolve(__dirname, 'src/components');
    const entries: Record<string, string> = {
        index: resolve(__dirname, 'src/index.ts')
    };

    try {
        const files = readdirSync(componentsPath);
        files.forEach((file) => {
            const fullPath = resolve(componentsPath, file);
            if (statSync(fullPath).isDirectory()) {
                entries[file] = resolve(fullPath, 'index.ts');
            }
        });
    } catch (e) {
        // Fallback if src/components directory does not exist or cannot be scanned yet
    }
    return entries;
};

export default defineConfig({
    plugins: [
        // Generates .d.ts type declaration files automatically
        dts({
            insertTypesEntry: true
        })
    ],
    build: {
        lib: {
            entry: getComponentEntries(),
            formats: ['es'],
        },
        // Output directly to local dist, letting Gradle harvest it safely
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
        rollupOptions: {
            external: [/^lit/, /^@lit/],
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: 'chunks/[name]-[hash].js',
                assetFileNames: 'assets/[name].[ext]',
            },
        },
    },
});