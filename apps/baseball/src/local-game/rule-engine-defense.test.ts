import { describe, expect, it } from 'vitest';
import { reduceGame } from './rule-engine';
import { apply, createDefaultGame, event } from './rule-engine-fixtures';

describe('rule engine: defensive events', () => {
    it('records at-bats for in-play outs', () => {
        const game = reduceGame(createDefaultGame(), event('GROUNDOUT'));
        expect(game.outs).toBe(1);
        expect(game.awayLineup.rows[0]!.atBats).toBe(1);
    });

    it('advances the batter after a flyout with the bases empty', () => {
        const game = reduceGame(createDefaultGame(), event('FLYOUT'));
        expect(game.outs).toBe(1);
        expect(game.awayBatterIdx).toBe(1);
    });

    it('scores a runner from third on a sacrifice fly', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
        expect(game.awayScore).toBe(0);
        expect(game.runners[2]).toBe(true);
        game = reduceGame(game, event('SACRIFICE_FLY'));
        expect(game.awayScore).toBe(1);
        expect(game.outs).toBe(1);
        expect(game.awayLineup.rows[3]!.rbi).toBe(1);
        expect(game.awayLineup.rows[3]!.atBats).toBe(0);
        expect(game.awayLineup.rows[0]!.runs).toBe(1);
    });

    it('does not score a runner from third on a plain flyout', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, event('FLYOUT'));
        expect(game.awayScore).toBe(0);
        expect(game.runners[2]).toBe(true);
        expect(game.outs).toBe(1);
        expect(game.awayLineup.rows[3]!.atBats).toBe(1);
    });

    it('records at-bats without an out for fielder choices and errors', () => {
        const game = apply(createDefaultGame(), event('ERROR'), event('FIELDER_CHOICE'));
        expect(game.outs).toBe(0);
        expect(game.awayLineup.rows[0]!.atBats).toBe(1);
        expect(game.awayLineup.rows[1]!.atBats).toBe(1);
    });
});

describe('rule engine: fielding positions and run marks', () => {
    it('records a groundout with the fielding positions', () => {
        const game = reduceGame(createDefaultGame(), { type: 'GROUNDOUT', fieldPos: 6 });
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell).toMatchObject({ notation: '6-3', outNum: 1 });
    });

    it('records a groundout fielded by first base without a pair', () => {
        const game = reduceGame(createDefaultGame(), { type: 'GROUNDOUT', fieldPos: 3 });
        expect(game.awayLineup.rows[0]!.innings['1']).toMatchObject({ notation: '3' });
    });

    it('falls back to GO without a fielding position', () => {
        const game = reduceGame(createDefaultGame(), event('GROUNDOUT'));
        expect(game.awayLineup.rows[0]!.innings['1']).toMatchObject({ notation: 'GO' });
    });

    it('records flyout, lineout, popout, and sac fly with positions', () => {
        let game = reduceGame(createDefaultGame(), { type: 'FLYOUT', fieldPos: 8 });
        expect(game.awayLineup.rows[0]!.innings['1']).toMatchObject({ notation: '8' });
        game = reduceGame(game, { type: 'LINE_OUT', fieldPos: 9 });
        expect(game.awayLineup.rows[1]!.innings['1']).toMatchObject({ notation: 'L9' });
        game = reduceGame(game, { type: 'POP_OUT', fieldPos: 6 });
        expect(game.awayLineup.rows[2]!.innings['1']).toMatchObject({ notation: 'P6' });
    });

    it('records an error and fielder choice with the fielder position', () => {
        let game = reduceGame(createDefaultGame(), { type: 'ERROR', fieldPos: 6 });
        expect(game.awayLineup.rows[0]!.innings['1']).toMatchObject({ notation: 'E6' });
        expect(game.homeErrors).toBe(1);
        game = reduceGame(game, { type: 'FIELDER_CHOICE', fieldPos: 4 });
        expect(game.awayLineup.rows[1]!.innings['1']).toMatchObject({ notation: 'FC4' });
    });

    it('places the batter on first base when he reaches on an error', () => {
        const game = reduceGame(createDefaultGame(), { type: 'ERROR', fieldPos: 6 });
        expect(game.runners).toEqual([true, false, false]);
        expect(game.runnerSlots).toEqual([1, null, null]);
        expect(game.runnerInnings).toEqual([1, null, null]);
    });

    it('advances runners one base when a batter reaches on an error', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'));
        game = reduceGame(game, { type: 'ERROR', fieldPos: 6 });
        expect(game.runners).toEqual([true, true, false]);
        expect(game.runnerSlots).toEqual([2, 1, null]);
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toEqual([{ from: 1, to: 2, scored: false }]);
    });

    it('scores the runner from third with an RBI when the bases are loaded and the batter reaches on an error', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, { type: 'ERROR', fieldPos: 6 });
        expect(game.awayScore).toBe(1);
        expect(game.awayLineup.rows[3]!.innings['1']).toMatchObject({ notation: 'E6', base: 1, rbiCount: 1 });
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toContainEqual({ from: 3, to: 4, scored: true });
    });

    it("retires the forced runner on first and puts the batter on base on a fielder's choice", () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'));
        game = reduceGame(game, { type: 'FIELDER_CHOICE', fieldPos: 4 });
        expect(game.runners).toEqual([true, false, false]);
        expect(game.runnerSlots).toEqual([2, null, null]);
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toBeUndefined();
    });

    it('marks a solo home run with a run dot and one RBI', () => {
        const game = reduceGame(createDefaultGame(), event('HOME_RUN'));
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'HR', run: true, rbiCount: 1 });
    });

    it('marks a single driving in a runner with an RBI but no run dot', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('DOUBLE'));
        game = reduceGame(game, event('SINGLE'));
        const cell = game.awayLineup.rows[2]!.innings['1']!;
        expect(cell).toMatchObject({ notation: '1B', run: false, rbiCount: 1 });
    });

    it('marks a bases-loaded walk with an RBI but no run dot', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, event('WALK'));
        const cell = game.awayLineup.rows[3]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'BB', run: false, rbiCount: 1 });
    });

    it('marks a sacrifice fly scoring a runner with an RBI', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, { type: 'SACRIFICE_FLY', fieldPos: 8 });
        const cell = game.awayLineup.rows[3]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'SF8', run: false, rbiCount: 1 });
        expect(game.outs).toBe(1);
    });
});

describe('rule engine: double plays', () => {
    it('records two outs on a 6-4-3 double play and retires the runner on first', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'));
        game = reduceGame(game, { type: 'GROUNDOUT', fieldPos: 6, doublePlay: true });
        expect(game.outs).toBe(2);
        expect(game.runners).toEqual([false, false, false]);
        expect(game.runnerSlots).toEqual([null, null, null]);
        expect(game.awayLineup.rows[1]!.innings['1']).toMatchObject({ notation: '6-4-3', outNum: 1 });
    });

    it('keeps runners on second and third when a force double play retires first', () => {
        let game = createDefaultGame();
        game = apply(game, event('WALK'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, { type: 'GROUNDOUT', fieldPos: 6, doublePlay: true });
        expect(game.runners).toEqual([false, true, true]);
        expect(game.runnerSlots).toEqual([null, 2, 1]);
        expect(game.outs).toBe(2);
    });

    it('flips the inning when a double play records the third out', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('STRIKEOUT'));
        game = reduceGame(game, { type: 'GROUNDOUT', fieldPos: 6, doublePlay: true });
        expect(game.outs).toBe(0);
        expect(game.half).toBe('BOTTOM');
        expect(game.awayLineup.rows[2]!.innings['1']!.hasEndedInningLine).toBe(true);
    });

    it('records a single out when a double play is requested without a runner on first', () => {
        const game = reduceGame(createDefaultGame(), { type: 'GROUNDOUT', fieldPos: 4, doublePlay: true });
        expect(game.outs).toBe(1);
        expect(game.awayLineup.rows[0]!.innings['1']).toMatchObject({ notation: '4-3' });
    });
});
