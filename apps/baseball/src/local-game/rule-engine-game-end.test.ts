import { describe, expect, it } from 'vitest';
import { isGameOver, isHitEventType, isOutEventType, reduceGame } from './rule-engine';
import type { EngineGameState, ScoringEvent } from './rule-engine';
import { apply, createDefaultGame, event } from './rule-engine-fixtures';

describe('rule engine: helpers and edge cases', () => {
    it('classifies event types', () => {
        expect(isHitEventType('HOME_RUN')).toBe(true);
        expect(isHitEventType('DOUBLE')).toBe(true);
        expect(isHitEventType('BALL')).toBe(false);
        expect(isOutEventType('STRIKEOUT')).toBe(true);
        expect(isOutEventType('GROUNDOUT')).toBe(true);
        expect(isOutEventType('CAUGHT_STEALING')).toBe(true);
        expect(isOutEventType('SINGLE')).toBe(false);
    });

    it('returns the game unchanged when it is over', () => {
        const game = { ...createDefaultGame(1), over: true };
        expect(reduceGame(game, event('HOME_RUN'))).toBe(game);
    });

    it('returns the game unchanged for an unknown event type', () => {
        const game = createDefaultGame();
        const next = reduceGame(game, { type: 'NOT_A_REAL_EVENT' } as unknown as ScoringEvent);
        expect(next).toBe(game);
    });

    it('reports the game as over', () => {
        expect(isGameOver(createDefaultGame(1))).toBe(false);
        expect(isGameOver({ ...createDefaultGame(1), over: true })).toBe(true);
    });

    it('has no runners or scores in the away lineup initially', () => {
        const game = createDefaultGame();
        expect(game.awayLineup.rows).toHaveLength(9);
        expect(game.awayLineup.rows[0]).toMatchObject({
            atBats: 0,
            runs: 0,
            hits: 0,
            rbi: 0,
            walks: 0,
        });
    });
});

describe('rule engine: extra innings and game ending', () => {
    it('continues into an extra inning when the final inning ends tied', () => {
        let game = createDefaultGame(1);
        game = apply(game, event('HOME_RUN'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = apply(game, event('HOME_RUN'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.over).toBe(false);
        expect(game.inning).toBe(2);
        expect(game.half).toBe('TOP');
    });

    it('ends on a walk-off home run in an extra inning', () => {
        let game: EngineGameState = {
            ...createDefaultGame(1),
            inning: 2,
            half: 'TOP',
            awayScore: 1,
            homeScore: 1,
            over: false,
        };
        game = apply(game, event('HOME_RUN'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = apply(game, event('HOME_RUN'));
        expect(game.over).toBe(false);
        game = reduceGame(game, event('HOME_RUN'));
        expect(game.over).toBe(true);
        expect(game.homeScore).toBe(3);
    });

    it('does not end the game when home takes a lead before the final inning', () => {
        let game = createDefaultGame(2);
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = reduceGame(game, event('HOME_RUN'));
        expect(game.over).toBe(false);
        expect(game.half).toBe('BOTTOM');
        expect(game.homeScore).toBe(1);
    });

    it('skips the bottom of the final inning when home is already leading', () => {
        let game: EngineGameState = {
            ...createDefaultGame(2),
            inning: 2,
            half: 'TOP',
            awayScore: 0,
            homeScore: 1,
            over: false,
        };
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.over).toBe(true);
        expect(game.inning).toBe(2);
    });

    it('ends on a walk-off home run in the bottom of the final inning', () => {
        let game: EngineGameState = {
            ...createDefaultGame(2),
            inning: 2,
            half: 'BOTTOM',
            awayScore: 1,
            homeScore: 1,
            over: false,
        };
        game = reduceGame(game, event('HOME_RUN'));
        expect(game.over).toBe(true);
        expect(game.homeScore).toBe(2);
    });

    it('ends when the away team wins the final inning outright', () => {
        let game = createDefaultGame(1);
        game = apply(game, event('HOME_RUN'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        game = apply(game, event('STRIKEOUT'), event('STRIKEOUT'), event('STRIKEOUT'));
        expect(game.over).toBe(true);
        expect(game.awayScore).toBe(1);
        expect(game.homeScore).toBe(0);
    });
});
