import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            // Lit shells need a DOM harness; measured logic lives in core + local-game + sim.
            include: ['src/core/**/*.ts', 'src/local-game/**/*.ts', 'src/sim/**/*.ts'],
            exclude: [
                // Type-only modules; vitest has no runtime to measure. Not
                // src/core/types.ts, which exports the runtime SCORING_EVENT_TYPES.
                'src/local-game/game-state.ts',
                'src/sim/types.ts',
            ],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 90,
                statements: 90,
            },
        },
    },
});
