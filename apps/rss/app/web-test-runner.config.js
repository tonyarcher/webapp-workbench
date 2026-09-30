// Component harness for the source-list, in real Chromium.
//
// The app itself cannot be driven by a browser test without the OAuth dev proxy
// and a seeded database, because every reader signs in through user-api and
// there is no anonymous mode. But a component can be mounted directly, which is
// all the sidebar splitter needs: the parts that mattered were the shadow-root
// lookup for the handle and the aria-valuenow write, and neither of those is
// reachable without a real DOM.
//
// Mirrors packages/web-components, including its inline-CSS plugin, because the
// component imports its stylesheet with "?inline" and esbuild cannot resolve
// that on its own.
import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import fs from 'fs';
import path from 'path';

function inlineCssPlugin() {
    return {
        name: 'inline-css-plugin',
        transform(context) {
            const cleanPath = context.path.split('?')[0];
            if (context.path.includes('?inline') || cleanPath.endsWith('.css')) {
                const filePath = path.resolve(process.cwd(), cleanPath.replace(/^\//, ''));
                if (fs.existsSync(filePath)) {
                    const cssContent = fs.readFileSync(filePath, 'utf-8');
                    return {
                        body: `export default ${JSON.stringify(cssContent)};`,
                        headers: { 'content-type': 'application/javascript; charset=utf-8' },
                    };
                }
            }
        },
    };
}

export default {
    files: 'test/**/*.test.ts',
    nodeResolve: true,
    plugins: [inlineCssPlugin(), esbuildPlugin({ ts: true, target: 'auto', tsconfig: './tsconfig.json' })],
    browsers: [playwrightLauncher({ product: 'chromium' })],
};
