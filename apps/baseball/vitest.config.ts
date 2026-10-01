import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            // Scoped to the code vitest actually runs. src/widgets is measured by
            // the wtr coverage gate in web-test-runner.config.js, which runs it in
            // real Chromium; vitest has no browser environment, so including it
            // here reports a number that means nothing.
            include: ['src/local-game/**/*.ts', 'src/sim/**/*.ts'],
            exclude: [
                // Type-only modules; vitest has no runtime to measure.
                'src/local-game/game-state.ts',
                'src/sim/types.ts',
            ],
            // No thresholds. This app never had a vitest coverage gate, and the
            // scopes that pass at 90% elsewhere are not this app's. The wtr gate
            // over src/widgets is the enforced one.
        },
    },
});
