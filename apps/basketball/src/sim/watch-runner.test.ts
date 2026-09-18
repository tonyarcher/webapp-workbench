import {describe, expect, it} from 'vitest';
import {createGame} from 'basketball-core';
import {DEFAULT_GAME_SETUP} from '../local-game/game-types';
import {delayForPlay, PlaybackClock, yieldDelay} from './playback';
import {WatchRunner, watchBadge, watchLoopAlive} from './watch-runner';

describe('watch-runner', () => {
    it('only emits in watch mode', () => {
        const runner = new WatchRunner();
        const score = {
            setup: DEFAULT_GAME_SETUP,
            engine: createGame(DEFAULT_GAME_SETUP),
            historyIndex: 0,
            events: [],
        };
        expect(runner.takeEvent(score)).toBeNull();
        const watch = {
            ...score,
            setup: {...DEFAULT_GAME_SETUP, mode: 'watch' as const, simSeed: 4},
        };
        expect(runner.takeEvent(watch)?.type).toBeTruthy();
        expect(watchLoopAlive(true, true, false)).toBe(true);
        expect(watchLoopAlive(true, false, false)).toBe(false);
        expect(watchBadge(true, false)).toBe('FINAL');
        expect(watchBadge(false, true)).toBe('LIVE');
        expect(watchBadge(false, false)).toBe('PAUSED');
        runner.reset();
        expect(runner.playing).toBe(false);
        expect(runner.delayMs({type: 'shot', team: 'away', shooterId: 'away-1', xFeet: 10, yFeet: 25, made: true, clock: {period: 1, gameClockSeconds: 1, shotClockSeconds: 1}})).toBeGreaterThan(0);
        const capped = {
            ...watch,
            historyIndex: 700,
        };
        expect(runner.takeEvent(capped)?.type).toBe('period_end');
        expect(runner.takeEvent({...watch, historyIndex: 720})).toBeNull();
        expect(runner.takeEvent({...watch, engine: {...watch.engine, over: true}})).toBeNull();
    });
});

describe('playback', () => {
    it('scales delay and aborts', async () => {
        expect(delayForPlay('shot', 0, true)).toBe(0);
        expect(delayForPlay('shot', 1, false)).toBeLessThanOrEqual(80);
        expect(delayForPlay('period_end', 1, true)).toBe(900);
        const clock = new PlaybackClock();
        let steps = 0;
        const run = clock.play(async () => {
            steps += 1;
            clock.pause();
            return true;
        });
        await run;
        expect(steps).toBe(1);
        await yieldDelay(1);
        const aborted = new AbortController();
        aborted.abort();
        await yieldDelay(50, aborted.signal);
        const clock2 = new PlaybackClock();
        await clock2.play(async () => {
            expect(clock2.signal).toBeDefined();
            return false;
        });
        expect(delayForPlay('free_throw', 2, true)).toBe(700);
        expect(delayForPlay('timeout', 1, true)).toBe(1600);
        const mid = new AbortController();
        const wait = yieldDelay(80, mid.signal);
        mid.abort();
        await wait;
    });
});
