import {defineConfig} from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
    plugins: [
        dts({
            include: ['src/**/*.ts'],
            rollupTypes: true,
        }),
    ],
    build: {
        lib: {
            entry: 'src/index.ts',
            formats: ['es'],
            fileName: 'vertical-scroll-core',
        },
        cssCodeSplit: false,
        minify: false,
    },
})
