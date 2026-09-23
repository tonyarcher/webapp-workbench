import { describe, expect, it } from 'vitest';
import { isBattingHalfTop, reduceGame } from './rule-engine';
import { apply, createDefaultGame, event } from './rule-engine-fixtures';

describe('rule engine: count and plate appearances', () => {
    it('starts at top of first inning with empty count', () => {
        const game = createDefaultGame();
        expect(game.inning).toBe(1);
        expect(isBattingHalfTop(game)).toBe(true);
        expect(game.half).toBe('TOP');
        expect(game.balls).toBe(0);
        expect(game.strikes).toBe(0);
        expect(game.outs).toBe(0);
        expect(game.awayScore).toBe(0);
        expect(game.homeScore).toBe(0);
        expect(game.runners).toEqual([false, false, false]);
        expect(game.over).toBe(false);
    });

    it('tracks ball count and converts the fourth ball into a walk', () => {
        let game = createDefaultGame();
        game = apply(game, event('BALL'), event('BALL'), event('BALL'));
        expect(game.balls).toBe(3);
        game = reduceGame(game, event('BALL'));
        expect(game.balls).toBe(0);
        expect(game.runners[0]).toBe(true);
        expect(game.awayLineup.rows[0]!.walks).toBe(1);
    });

    it('advances strikes and turns the third strike into a strikeout', () => {
        let game = createDefaultGame();
        game = apply(game, event('STRIKE'), event('STRIKE'));
        expect(game.strikes).toBe(2);
        game = reduceGame(game, event('STRIKE'));
        expect(game.outs).toBe(1);
        expect(game.strikes).toBe(0);
        expect(game.awayLineup.rows[0]!.atBats).toBe(1);
    });

    it('caps foul balls at two strikes', () => {
        let game = createDefaultGame();
        game = apply(game, event('STRIKE'), event('STRIKE'), event('FOUL'), event('FOUL'));
        expect(game.strikes).toBe(2);
        expect(game.outs).toBe(0);
    });

    it('records a strikeout from a two-strike foul sequence correctly', () => {
        let game = createDefaultGame();
        game = apply(game, event('FOUL'), event('STRIKE'));
        expect(game.strikes).toBe(2);
        game = reduceGame(game, event('STRIKE'));
        expect(game.outs).toBe(1);
    });

    it('cycles the batting order to the next batter after a plate appearance', () => {
        let game = createDefaultGame();
        expect(game.awayBatterIdx).toBe(0);
        game = reduceGame(game, event('STRIKEOUT'));
        expect(game.awayBatterIdx).toBe(1);
        game = reduceGame(game, event('STRIKEOUT'));
        expect(game.awayBatterIdx).toBe(2);
    });

    it('wraps the batting order after nine plate appearances in the same half', () => {
        const game = apply(
            createDefaultGame(),
            event('STRIKEOUT'),
            event('STRIKEOUT'),
            ...Array.from({ length: 7 }, () => event('WALK')),
        );
        expect(game.awayBatterIdx).toBe(0);
        expect(game.half).toBe('TOP');
        expect(game.outs).toBe(2);
    });

    it('does not treat a walk as an official at-bat', () => {
        const game = reduceGame(createDefaultGame(), event('WALK'));
        expect(game.awayLineup.rows[0]!.walks).toBe(1);
        expect(game.awayLineup.rows[0]!.atBats).toBe(0);
    });

    it('records hit-by-pitch as HBP without a walk or at-bat', () => {
        const game = reduceGame(createDefaultGame(), event('HIT_BY_PITCH'));
        expect(game.awayLineup.rows[0]!.innings['1']).toMatchObject({ notation: 'HBP', base: 1 });
        expect(game.awayLineup.rows[0]!.walks).toBe(0);
        expect(game.awayLineup.rows[0]!.atBats).toBe(0);
        expect(game.runners[0]).toBe(true);
    });
});

describe('rule engine: outs and inning flips', () => {
    it('flips to the bottom of the first inning after three outs', () => {
        let game = createDefaultGame();
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.half).toBe('BOTTOM');
        expect(game.inning).toBe(1);
        expect(game.outs).toBe(0);
        expect(game.homeBatterIdx).toBe(0);
        expect(game.awayBatterIdx).toBe(3);
    });

    it('continues the batting order from the next slot in the following inning', () => {
        let game = createDefaultGame();
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.half).toBe('TOP');
        expect(game.inning).toBe(2);
        expect(game.awayBatterIdx).toBe(3);
        expect(game.homeBatterIdx).toBe(3);
    });

    it('keeps the runner on base when the half inning flips', () => {
        let game = createDefaultGame();
        game = apply(game, event('WALK'), event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.half).toBe('BOTTOM');
        expect(game.runners).toEqual([false, false, false]);
    });

    it('advances to the top of the second inning after the bottom half', () => {
        let game = createDefaultGame();
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.inning).toBe(2);
        expect(game.half).toBe('TOP');
    });

    it('ends the game when the home team walks off in the final inning', () => {
        let game = createDefaultGame(1);
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = apply(game, event('HOME_RUN'));
        expect(game.half).toBe('BOTTOM');
        expect(game.inning).toBe(1);
        expect(game.over).toBe(true);
    });

    it('ends the game early when the home team leads in the final inning', () => {
        let game = createDefaultGame(1);
        game = apply(game, event('HOME_RUN'), event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.awayScore).toBe(1);
        expect(game.half).toBe('BOTTOM');
        game = apply(game, event('HOME_RUN'), event('HOME_RUN'));
        expect(game.homeScore).toBe(2);
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.over).toBe(true);
    });
});
