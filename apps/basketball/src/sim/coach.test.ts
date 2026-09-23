import { describe, expect, it } from 'vitest';
import { createGame } from 'basketball-core';
import { DEFAULT_GAME_SETUP } from '../local-game/game-types';
import { pickShooter, pickZone, ratingsFor, shouldAssist, shouldSub } from './coach';
import { mulberry32 } from './rng';

describe('coach', () => {
    it('picks on-court shooters and occasional subs', () => {
        const game = createGame(DEFAULT_GAME_SETUP);
        const random = mulberry32(2);
        const shooter = pickShooter(game, 'away', random);
        expect(game.away.onCourt.includes(shooter)).toBe(true);
        expect(ratingsFor('missing', undefined).shooting).toBe(50);
        expect(['paint', 'mid', 'three']).toContain(pickZone(random, ratingsFor('away-1', undefined)));
        expect(typeof shouldAssist(random, ratingsFor('away-1', undefined))).toBe('boolean');
        let found = false;
        for (let i = 0; i < 80; i += 1) {
            if (shouldSub(game, 'away', mulberry32(i))) found = true;
        }
        expect(found).toBe(true);
        const zeros = Object.fromEntries(
            game.away.onCourt.map((id) => [
                id,
                {
                    shooting: 0,
                    three: 0,
                    playmaking: 0,
                    rebounding: 0,
                    defense: 0,
                    stamina: 0,
                },
            ]),
        );
        expect(game.away.onCourt.includes(pickShooter(game, 'away', random, zeros))).toBe(true);
        expect(game.away.onCourt.includes(pickShooter(game, 'away', () => 0.9999))).toBe(true);
    });
});
