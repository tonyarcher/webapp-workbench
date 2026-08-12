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
            headers: { 'content-type': 'application/javascript; charset=utf-8' }
          };
        }
      }
    },
  };
}

export default {
  files: 'test/**/*.test.ts',
  nodeResolve: true,
  plugins: [
    inlineCssPlugin(),
    esbuildPlugin({ ts: true, target: 'auto', tsconfig: './tsconfig.json' }),
  ],
  browsers: [
    playwrightLauncher({ product: 'chromium' }),
  ],
  coverageConfig: {
    report: true,
    reportDir: 'coverage',
    threshold: {
      statements: 90,
      branches: 80,
      functions: 90,
      lines: 90,
    },
  },
};
