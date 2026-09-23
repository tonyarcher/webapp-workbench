import { describe, expect, it } from 'vitest';
import { createGame, reduce } from 'basketball-core';
import { DEFAULT_GAME_SETUP } from '../local-game/game-types';
import { nextEvent, rngForEngine } from './resolve-play';

describe('nextEvent', () => {
    it('ends the period when the clock is out', () => {
        const game = createGame(DEFAULT_GAME_SETUP);
        const expired = { ...game, clock: { ...game.clock, gameClockSeconds: 0 } };
        expect(nextEvent(expired, () => 0).type).toBe('period_end');
    });

    it('emits a legal event on a live clock', () => {
        let engine = createGame(DEFAULT_GAME_SETUP);
        for (let i = 0; i < 40; i += 1) {
            const event = nextEvent(engine, rngForEngine(7, engine, i));
            expect(event.type).toBeTruthy();
            engine = reduce(engine, event);
        }
        expect(engine.shots.length + engine.clock.period).toBeGreaterThan(1);
    });
});
