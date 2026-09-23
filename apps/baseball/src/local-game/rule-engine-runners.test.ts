import { describe, expect, it } from 'vitest';
import { reduceGame } from './rule-engine';
import { apply, createDefaultGame, event } from './rule-engine-fixtures';

describe('rule engine: runners and runs', () => {
    it('walks home a runner with the bases loaded', () => {
        const game = apply(createDefaultGame(), event('WALK'), event('WALK'), event('WALK'), event('WALK'));
        expect(game.awayScore).toBe(1);
        expect(game.runners).toEqual([true, true, true]);
        expect(game.awayLineup.rows[3]!.rbi).toBe(1);
        expect(game.awayLineup.rows[0]!.runs).toBe(1);
        expect(game.awayLineup.rows[3]!.atBats).toBe(0);
    });

    it('places the batter on first and keeps a runner on third after a walk', () => {
        let game = createDefaultGame();
        game = reduceGame(game, { type: 'WALK' });
        game = reduceGame(game, { type: 'SINGLE' });
        game = reduceGame(game, { type: 'SINGLE' });
        game = reduceGame(game, { type: 'STRIKEOUT' });
        expect(game.runners).toEqual([true, true, true]);
        game = reduceGame(game, { type: 'WALK' });
        expect(game.awayScore).toBe(1);
        expect(game.runners).toEqual([true, true, true]);
    });

    it('scores a runner from third on a single', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
        expect(game.awayScore).toBe(0);
        expect(game.runners).toEqual([true, true, true]);
        game = reduceGame(game, event('SINGLE'));
        expect(game.awayScore).toBe(1);
    });

    it('scores two runners on a double with runners on first and second', () => {
        let game = createDefaultGame();
        game = apply(game, event('WALK'), event('WALK'));
        expect(game.runners).toEqual([true, true, false]);
        game = reduceGame(game, event('DOUBLE'));
        expect(game.awayScore).toBe(1);
        expect(game.runners[1]).toBe(true);
    });

    it('scores all runners and the batter on a grand slam', () => {
        let game = createDefaultGame();
        game = apply(game, event('WALK'), event('WALK'), event('WALK'));
        game = reduceGame(game, event('HOME_RUN'));
        expect(game.awayScore).toBe(4);
        expect(game.runners).toEqual([false, false, false]);
        expect(game.awayLineup.rows[3]!.hits).toBe(1);
        expect(game.awayLineup.rows[3]!.rbi).toBe(4);
    });

    it('a home run with the bases empty scores one run', () => {
        const game = reduceGame(createDefaultGame(), event('HOME_RUN'));
        expect(game.awayScore).toBe(1);
        expect(game.awayLineup.rows[0]!.rbi).toBe(1);
        expect(game.awayLineup.rows[0]!.runs).toBe(1);
    });

    it('tracks runs and RBIs on the scorebook rows', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'));
        expect(game.awayScore).toBe(0);
        game = reduceGame(game, event('TRIPLE'));
        expect(game.awayScore).toBe(2);
        expect(game.awayLineup.rows[2]!.rbi).toBe(2);
    });
});

describe('rule engine: runner advancement arcs', () => {
    it("advances a runner from first to third on a double, marked in the runner's own cell", () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'));
        game = reduceGame(game, event('DOUBLE'));
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell.advancements).toEqual([{ from: 1, to: 3, scored: false }]);
        expect(game.awayLineup.rows[1]!.innings['1']!.advancements).toBeUndefined();
    });

    it('advances the first batter to second when a second batter singles', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'));
        game = reduceGame(game, event('SINGLE'));
        expect(game.runners).toEqual([true, true, false]);
        expect(game.runnerSlots).toEqual([2, 1, null]);
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell.advancements).toEqual([{ from: 1, to: 2, scored: false }]);
        expect(game.awayLineup.rows[1]!.innings['1']!.advancements).toBeUndefined();
    });

    it('advances runners one base on a walk and scores the runner from third', () => {
        let game = createDefaultGame();
        game = apply(game, event('WALK'), event('WALK'), event('WALK'));
        game = reduceGame(game, event('WALK'));
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toEqual([
            { from: 1, to: 2, scored: false },
            { from: 2, to: 3, scored: false },
            { from: 3, to: 4, scored: true },
        ]);
        expect(game.awayLineup.rows[1]!.innings['1']!.advancements).toEqual([
            { from: 1, to: 2, scored: false },
            { from: 2, to: 3, scored: false },
        ]);
        expect(game.awayLineup.rows[2]!.innings['1']!.advancements).toEqual([{ from: 1, to: 2, scored: false }]);
        expect(game.awayLineup.rows[3]!.innings['1']!.advancements).toBeUndefined();
    });

    it("moves runners up on a single, marking each runner's advance in their own cell", () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, event('SINGLE'));
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toEqual([
            { from: 1, to: 2, scored: false },
            { from: 2, to: 3, scored: false },
        ]);
        expect(game.awayLineup.rows[1]!.innings['1']!.advancements).toEqual([{ from: 1, to: 2, scored: false }]);
        expect(game.awayLineup.rows[2]!.innings['1']!.advancements).toBeUndefined();
    });

    it('scores runners from first and second on a triple, marking each scorer in their own cell', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, event('TRIPLE'));
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toEqual([
            { from: 1, to: 2, scored: false },
            { from: 2, to: 4, scored: true },
        ]);
        expect(game.awayLineup.rows[1]!.innings['1']!.advancements).toEqual([{ from: 1, to: 4, scored: true }]);
    });

    it('records a sacrifice fly advancement when a runner scores from third', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, { type: 'SACRIFICE_FLY', fieldPos: 8 });
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell.advancements).toEqual([
            { from: 1, to: 2, scored: false },
            { from: 2, to: 3, scored: false },
            { from: 3, to: 4, scored: true },
        ]);
        expect(game.awayLineup.rows[1]!.innings['1']!.advancements).toEqual([{ from: 1, to: 2, scored: false }]);
        expect(game.awayLineup.rows[2]!.innings['1']!.advancements).toBeUndefined();
    });

    it('keeps advancement records empty for a home run with no runners', () => {
        const game = reduceGame(createDefaultGame(), event('HOME_RUN'));
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toBeUndefined();
    });

    it('leaves advancements unset for outs and strikeouts', () => {
        let game = reduceGame(createDefaultGame(), { type: 'GROUNDOUT', fieldPos: 6 });
        expect(game.awayLineup.rows[0]!.innings['1']!.advancements).toBeUndefined();
        game = reduceGame(game, event('STRIKEOUT'));
        expect(game.awayLineup.rows[1]!.innings['1']!.advancements).toBeUndefined();
    });
});

describe('rule engine: runner identity', () => {
    it('tracks which batter occupies first base after a single', () => {
        const game = reduceGame(createDefaultGame(), event('SINGLE'));
        expect(game.runnerSlots).toEqual([1, null, null]);
        expect(game.runners).toEqual([true, false, false]);
    });

    it('shifts runner slots when a later batter hits a double', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'));
        game = reduceGame(game, event('DOUBLE'));
        expect(game.runnerSlots).toEqual([null, 2, 1]);
    });

    it('walks the batter to first and shuffles the other runners', () => {
        let game = createDefaultGame();
        game = apply(game, event('WALK'), event('WALK'));
        expect(game.runnerSlots).toEqual([2, 1, null]);
    });

    it('scores a runner from third on a sacrifice fly and clears that base slot', () => {
        let game = createDefaultGame();
        game = apply(game, event('WALK'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, { type: 'SACRIFICE_FLY', fieldPos: 8 });
        expect(game.runnerSlots).toEqual([3, 2, null]);
        expect(game.awayScore).toBe(1);
    });

    it('clears all runner slots after a home run', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, event('HOME_RUN'));
        expect(game.runnerSlots).toEqual([null, null, null]);
    });

    it('clears runner slots when the inning flips', () => {
        let game = createDefaultGame();
        game = apply(game, event('WALK'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.runnerSlots).toEqual([null, null, null]);
    });

    it('tracks the inning where each runner reached base', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'), event('SINGLE'));
        expect(game.runnerSlots).toEqual([4, 3, 2]);
        expect(game.runnerInnings).toEqual([1, 1, 1]);
    });

    it('records the origin inning of a runner from a later inning', () => {
        let game = createDefaultGame();
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = reduceGame(game, event('SINGLE'));
        expect(game.inning).toBe(2);
        expect(game.awayBatterIdx).toBe(4);
        expect(game.runnerSlots).toEqual([4, null, null]);
        expect(game.runnerInnings).toEqual([2, null, null]);
    });

    it('clears runner origin innings when the inning flips', () => {
        let game = createDefaultGame();
        game = apply(game, event('WALK'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.runnerInnings).toEqual([null, null, null]);
    });
});
