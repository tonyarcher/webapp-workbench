import { describe, expect, it } from 'vitest';
import { reduceGame } from './rule-engine';
import { apply, createDefaultGame, event } from './rule-engine-fixtures';

describe('rule engine: scorebook cells', () => {
    it('records a strikeout cell with notation, count, and out number', () => {
        let game = createDefaultGame();
        game = apply(game, event('BALL'), event('STRIKE'), event('STRIKE'));
        game = reduceGame(game, event('STRIKEOUT'));
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'K', count: '1-2', outNum: 1, hasEndedInningLine: false });
    });

    it('records a walk cell with the batter reaching first base', () => {
        const game = reduceGame(createDefaultGame(), event('WALK'));
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'BB', base: 1, outNum: null, hasEndedInningLine: false });
    });

    it('records a home run cell without a base marker', () => {
        const game = reduceGame(createDefaultGame(), event('HOME_RUN'));
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'HR', base: 0, outNum: null });
    });

    it('records a single cell with the batter reaching first', () => {
        const game = reduceGame(createDefaultGame(), event('SINGLE'));
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell).toMatchObject({ notation: '1B', base: 1 });
    });

    it('records a groundout cell with the out number', () => {
        const game = reduceGame(createDefaultGame(), event('GROUNDOUT'));
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'GO', outNum: 1 });
    });

    it('records a sacrifice fly cell for the batter', () => {
        let game = createDefaultGame();
        game = apply(game, event('SINGLE'), event('SINGLE'), event('SINGLE'));
        game = reduceGame(game, event('SACRIFICE_FLY'));
        const cell = game.awayLineup.rows[3]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'SF', outNum: 1 });
    });

    it('marks the third out as ending the inning', () => {
        let game = createDefaultGame();
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'));
        game = reduceGame(game, event('STRIKEOUT'));
        const cell = game.awayLineup.rows[2]!.innings['1']!;
        expect(cell).toMatchObject({ outNum: 3, hasEndedInningLine: true });
        expect(game.half).toBe('BOTTOM');
    });

    it('records an error cell with the batter reaching first without an out', () => {
        const game = reduceGame(createDefaultGame(), event('ERROR'));
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'E', base: 1, outNum: null });
        expect(game.outs).toBe(0);
    });

    it('records a fielder choice cell', () => {
        const game = reduceGame(createDefaultGame(), event('FIELDER_CHOICE'));
        const cell = game.awayLineup.rows[0]!.innings['1']!;
        expect(cell).toMatchObject({ notation: 'FC', base: 1 });
    });

    it('keeps a struck-out batter cell intact after the inning flips', () => {
        let game = createDefaultGame();
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        const cell = game.awayLineup.rows[2]!.innings['1']!;
        expect(cell.notation).toBe('K');
        expect(game.homeLineup.rows[0]!.innings).toEqual({});
    });
});

describe('rule engine: per-inning runs and errors', () => {
    it('records runs by inning for each team', () => {
        let game = createDefaultGame(1);
        game = apply(game, event('HOME_RUN'));
        expect(game.awayRunsByInning).toEqual([1]);
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = apply(game, event('HOME_RUN'), event('HOME_RUN'));
        expect(game.homeRunsByInning).toEqual([2]);
        expect(game.awayRunsByInning).toEqual([1]);
    });

    it('charges errors to the fielding team', () => {
        let game = createDefaultGame();
        game = reduceGame(game, event('ERROR'));
        expect(game.homeErrors).toBe(1);
        expect(game.awayErrors).toBe(0);
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = reduceGame(game, event('ERROR'));
        expect(game.awayErrors).toBe(1);
        expect(game.homeErrors).toBe(1);
    });

    it('does not charge a fielder choice as an error', () => {
        const game = reduceGame(createDefaultGame(), event('FIELDER_CHOICE'));
        expect(game.homeErrors).toBe(0);
    });
});
