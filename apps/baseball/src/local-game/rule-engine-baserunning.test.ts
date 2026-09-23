import { describe, expect, it } from 'vitest';
import { reduceGame } from './rule-engine';
import { apply, createDefaultGame, event } from './rule-engine-fixtures';

describe('rule engine: lineups and baserunning', () => {
    it('renames batters and the pitcher from a SET_LINEUP event', () => {
        const game = reduceGame(createDefaultGame(), {
            type: 'SET_LINEUP',
            awayLineup: [{ batterName: 'Tony Gwynn', position: 'RF', jerseyNumber: 19 }],
            awayPitcherName: 'Trevor Hoffman',
        });
        expect(game.awayLineup.rows[0]!.batterName).toBe('Tony Gwynn');
        expect(game.awayLineup.rows[0]!.position).toBe('RF');
        expect(game.awayLineup.rows[0]!.jerseyNumber).toBe(19);
        expect(game.awayLineup.pitcherName).toBe('Trevor Hoffman');
        expect(game.awayLineup.rows[1]!.batterName).toBe('Paul Goldschmidt');
    });

    it('steals second when first is occupied', () => {
        let game = reduceGame(createDefaultGame(), event('SINGLE'));
        game = reduceGame(game, { type: 'STOLEN_BASE', base: 2 });
        expect(game.runners).toEqual([false, true, false]);
        expect(game.runnerSlots).toEqual([null, 1, null]);
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toEqual([{ from: 1, to: 2, scored: false }]);
    });

    it('scores a runner from third on a wild pitch without an RBI', () => {
        let game = apply(createDefaultGame(), event('SINGLE'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, { type: 'WILD_PITCH' });
        expect(game.awayScore).toBe(1);
        expect(game.awayLineup.rows[0]!.runs).toBe(1);
        expect(game.awayLineup.rows[3]!.rbi).toBe(0);
        expect(game.runners).toEqual([false, true, true]);
    });

    it('records an out on a caught stealing', () => {
        let game = reduceGame(createDefaultGame(), event('WALK'));
        game = reduceGame(game, { type: 'CAUGHT_STEALING', base: 2 });
        expect(game.outs).toBe(1);
        expect(game.runners).toEqual([false, false, false]);
        expect(game.awayBatterIdx).toBe(1);
    });

    it("writes CS notation and an out number on the runner's own cell", () => {
        let game = reduceGame(createDefaultGame(), event('WALK'));
        game = reduceGame(game, { type: 'CAUGHT_STEALING', base: 2 });
        expect(game.awayLineup.rows[0]!.innings['1']).toMatchObject({
            notation: 'BB CS',
            base: 1,
            outNum: 1,
            hasEndedInningLine: false,
        });
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toEqual([{ from: 1, to: 2, scored: false }]);
    });

    it('does not mark a run when a runner is caught stealing home', () => {
        let game = apply(createDefaultGame(), event('SINGLE'), event('SINGLE'), event('SINGLE'));
        expect(game.runners[2]).toBe(true);
        game = reduceGame(game, { type: 'CAUGHT_STEALING', base: 4 });
        expect(game.awayScore).toBe(0);
        expect(game.awayLineup.rows[0]!.runs).toBe(0);
        expect(game.outs).toBe(1);
        expect(game.runners[2]).toBe(false);
        expect(game.awayLineup.rows[0]!.innings['1']).toMatchObject({
            notation: '1B CS',
            outNum: 1,
            run: false,
        });
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toContainEqual({ from: 3, to: 4, scored: false });
    });

    it('ends the inning on a caught stealing for the third out', () => {
        let game = apply(createDefaultGame(), event('WALK'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.outs).toBe(2);
        game = reduceGame(game, { type: 'CAUGHT_STEALING', base: 2 });
        expect(game.half).toBe('BOTTOM');
        expect(game.awayLineup.rows[0]!.innings['1']).toMatchObject({
            notation: 'BB CS',
            outNum: 3,
            hasEndedInningLine: true,
        });
    });

    it('advances runners on a sacrifice bunt without charging an at-bat', () => {
        let game = reduceGame(createDefaultGame(), event('SINGLE'));
        game = reduceGame(game, { type: 'SACRIFICE_BUNT', fieldPos: 1 });
        expect(game.outs).toBe(1);
        expect(game.runners).toEqual([false, true, false]);
        expect(game.awayLineup.rows[1]!.atBats).toBe(0);
        expect(game.awayLineup.rows[1]!.innings['1']).toMatchObject({ notation: 'SH1', outNum: 1 });
    });
});
