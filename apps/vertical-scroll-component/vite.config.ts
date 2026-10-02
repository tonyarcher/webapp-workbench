import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [
        dts({
            include: ['src/**/*.ts'],
        }),
    ],
    build: {
        lib: {
            entry: 'src/index.ts',
            formats: ['es'],
            fileName: 'vertical-scroll-component',
        },
        cssCodeSplit: false,
        minify: false,
        rollupOptions: {
            // lit is a peerDependency, so the consumer supplies it and this
            // bundle must not carry a second copy. Vite's lib mode bundles peers
            // anyway when nothing is marked external, which is how ~25KB of Lit
            // ended up inlined here: a page importing both this bundle and lit
            // directly was running two copies. That costs bundle size and gives
            // two distinct LitElement classes, so instanceof against a component
            // from the other copy is false. It does NOT cause a double-registration
            // error, because the @customElement decorators run once per module
            // evaluation and nothing re-evaluates them.
            external: ['lit', /^lit\/.*/],
        },
    },
});
