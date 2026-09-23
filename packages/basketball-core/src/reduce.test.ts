import { describe, expect, it } from 'vitest';
import { leftHoop } from './court-geom';
import { createGame, reduce, replay } from './reduce';
import { NBA, NCAA } from './rulebook';
import { boxRows } from './box-score';
import { describeEvent } from './notation';
import type { ClockStamp, GameSetup, ScoringEvent, ShotEvent } from './types';

const SETUP: GameSetup = {
    homeName: 'Home',
    awayName: 'Away',
    rulebookId: 'nba',
    openingPossession: 'away',
};

function stamp(gameClockSeconds: number, shotClockSeconds = 24, period = 1): ClockStamp {
    return { period, gameClockSeconds, shotClockSeconds };
}

function paintMake(overrides: Partial<ShotEvent> = {}): ShotEvent {
    const hoop = leftHoop(NBA.court);
    return {
        type: 'shot',
        team: 'away',
        shooterId: 'away-1',
        xFeet: hoop.x + 8,
        yFeet: hoop.y,
        made: true,
        clock: stamp(700),
        ...overrides,
    };
}

function threeMake(): ShotEvent {
    const hoop = leftHoop(NBA.court);
    return paintMake({
        xFeet: hoop.x + 30,
        yFeet: hoop.y,
        assistId: 'away-2',
    });
}

describe('createGame', () => {
    it('puts five on the floor and the opening team on offense', () => {
        const game = createGame(SETUP);
        expect(game.home.onCourt).toHaveLength(5);
        expect(game.away.onCourt).toHaveLength(5);
        expect(game.possession).toBe('away');
        expect(game.clock.gameClockSeconds).toBe(720);
        expect(game.homeAttacksLeft).toBe(false);
    });
});

describe('shots', () => {
    it('counts a paint make as two and flips possession', () => {
        const game = reduce(createGame(SETUP), paintMake());
        expect(game.score.away).toBe(2);
        expect(game.possession).toBe('home');
        expect(game.shots[0]?.made).toBe(true);
        expect(game.shots[0]?.points).toBe(2);
        expect(game.stats['away-1']?.fgm).toBe(1);
        expect(game.stats['away-1']?.pts).toBe(2);
    });

    it('counts a three with an on-court assist', () => {
        const game = reduce(createGame(SETUP), threeMake());
        expect(game.score.away).toBe(3);
        expect(game.stats['away-1']?.tpm).toBe(1);
        expect(game.stats['away-2']?.ast).toBe(1);
        expect(game.shots[0]?.assistId).toBe('away-2');
    });

    it('ignores an assist on a miss and off-court passer', () => {
        const miss = paintMake({ made: false, assistId: 'away-2' });
        const missed = reduce(createGame(SETUP), miss);
        expect(missed.score.away).toBe(0);
        expect(missed.possession).toBe('away');
        expect(missed.stats['away-2']?.ast).toBe(0);
        const bad = reduce(createGame(SETUP), paintMake({ assistId: 'away-3' }));
        expect(bad.stats['away-3']?.ast).toBe(0);
        expect(bad.score.away).toBe(2);
    });

    it('rejects a shooter who is not on the floor', () => {
        const game = reduce(createGame(SETUP), paintMake({ shooterId: 'away-3' }));
        expect(game.score.away).toBe(0);
        expect(game.shots).toHaveLength(0);
    });

    it('and-one leaves the shooting team at the line', () => {
        const game = reduce(createGame(SETUP), paintMake({ shootingFoul: true }));
        expect(game.score.away).toBe(2);
        expect(game.possession).toBe('away');
        expect(game.pendingFt?.remaining).toBe(1);
        expect(game.pendingFt?.andOne).toBe(true);
        const after = reduce(game, { type: 'free_throw', shooterId: 'away-1', made: true, clock: stamp(700) });
        expect(after.score.away).toBe(3);
        expect(after.possession).toBe('home');
        expect(after.pendingFt).toBeNull();
    });
});

describe('free throws and bonus', () => {
    it('stops a 1-and-1 after a miss', () => {
        let game = createGame({ ...SETUP, rulebookId: 'ncaa' });
        for (let i = 0; i < 7; i += 1) {
            game = reduce(game, {
                type: 'foul',
                team: 'home',
                playerId: 'home-1',
                fouledId: 'away-1',
                clock: stamp(1100),
            });
        }
        expect(game.pendingFt?.oneAndOne).toBe(true);
        expect(game.pendingFt?.remaining).toBe(2);
        game = reduce(game, { type: 'free_throw', shooterId: 'away-1', made: false, clock: stamp(1100) });
        expect(game.pendingFt).toBeNull();
        expect(game.stats['away-1']?.fta).toBe(1);
        expect(game.stats['away-1']?.ftm).toBe(0);
    });

    it('NBA fifth team foul is two shots', () => {
        let game = createGame(SETUP);
        for (let i = 0; i < 5; i += 1) {
            game = reduce(game, {
                type: 'foul',
                team: 'home',
                playerId: 'home-1',
                fouledId: 'away-1',
                clock: stamp(700),
            });
        }
        expect(game.pendingFt?.oneAndOne).toBe(false);
        expect(game.pendingFt?.remaining).toBe(2);
        expect(game.teamFouls.home).toBe(5);
    });
});

describe('rebound and shot clock', () => {
    it('resets to 14 on an NBA offensive rebound', () => {
        let game = reduce(createGame(SETUP), paintMake({ made: false, clock: stamp(680, 8) }));
        game = reduce(game, {
            type: 'rebound',
            team: 'away',
            playerId: 'away-11',
            offensive: true,
            clock: stamp(678, 8),
        });
        expect(game.possession).toBe('away');
        expect(game.clock.shotClockSeconds).toBe(14);
        expect(game.stats['away-11']?.orb).toBe(1);
    });

    it('flips possession on a defensive rebound', () => {
        let game = reduce(createGame(SETUP), paintMake({ made: false }));
        game = reduce(game, {
            type: 'rebound',
            team: 'home',
            playerId: 'home-1',
            offensive: false,
            clock: stamp(698),
        });
        expect(game.possession).toBe('home');
        expect(game.clock.shotClockSeconds).toBe(24);
        expect(game.stats['home-1']?.drb).toBe(1);
    });
});

describe('substitutions', () => {
    it('keeps five on the floor', () => {
        const game = reduce(createGame(SETUP), { type: 'substitution', team: 'away', outId: 'away-1', inId: 'away-3' });
        expect(game.away.onCourt).toHaveLength(5);
        expect(game.away.onCourt.includes('away-3')).toBe(true);
        expect(game.away.onCourt.includes('away-1')).toBe(false);
        const illegal = reduce(game, { type: 'substitution', team: 'away', outId: 'away-2', inId: 'away-3' });
        expect(illegal.away.onCourt).toEqual(game.away.onCourt);
    });
});

describe('clock and periods', () => {
    it('set_clock writes the bug', () => {
        const game = reduce(createGame(SETUP), {
            type: 'set_clock',
            clock: stamp(65, 14),
            running: true,
        });
        expect(game.clock.gameClockSeconds).toBe(65);
        expect(game.clock.shotClockSeconds).toBe(14);
        expect(game.clock.running).toBe(true);
    });

    it('ends regulation when the score is not tied', () => {
        let game = createGame(SETUP);
        game = reduce(game, paintMake());
        game = { ...game, clock: { ...game.clock, period: 4 } };
        game = reduce(game, { type: 'period_end' });
        expect(game.over).toBe(true);
    });

    it('goes to overtime when tied', () => {
        let game = createGame(SETUP);
        game = { ...game, clock: { ...game.clock, period: 4 } };
        game = reduce(game, { type: 'period_end' });
        expect(game.over).toBe(false);
        expect(game.clock.period).toBe(5);
        expect(game.clock.gameClockSeconds).toBe(300);
        expect(game.home.timeouts).toBe(1);
    });

    it('flips baskets and opening possession at half', () => {
        let game = createGame(SETUP);
        game = { ...game, clock: { ...game.clock, period: 2 } };
        game = reduce(game, { type: 'period_end' });
        expect(game.homeAttacksLeft).toBe(true);
        expect(game.possession).toBe('home');
        expect(game.clock.period).toBe(3);
    });

    it('college half is after period 1', () => {
        let game = createGame({ ...SETUP, rulebookId: 'ncaa' });
        game = reduce(game, { type: 'period_end' });
        expect(game.clock.period).toBe(2);
        expect(game.homeAttacksLeft).toBe(true);
        expect(game.clock.gameClockSeconds).toBe(NCAA.periodLengthSeconds);
    });
});

describe('turnover timeout lineup', () => {
    it('steals flip the ball', () => {
        const game = reduce(createGame(SETUP), {
            type: 'turnover',
            team: 'away',
            playerId: 'away-1',
            stealPlayerId: 'home-1',
            clock: stamp(690),
        });
        expect(game.possession).toBe('home');
        expect(game.stats['away-1']?.tov).toBe(1);
        expect(game.stats['home-1']?.stl).toBe(1);
    });

    it('timeouts decrement and stop the clock', () => {
        const game = reduce(createGame(SETUP), { type: 'timeout', team: 'home' });
        expect(game.home.timeouts).toBe(6);
        expect(game.clock.running).toBe(false);
        let empty = game;
        for (let i = 0; i < 10; i += 1) empty = reduce(empty, { type: 'timeout', team: 'home' });
        expect(empty.home.timeouts).toBe(0);
    });

    it('set_lineup replaces the five', () => {
        const onCourt = ['away-3', 'away-4', 'away-12', 'away-22', 'away-33'];
        const game = reduce(createGame(SETUP), { type: 'set_lineup', team: 'away', onCourt });
        expect(game.away.onCourt).toEqual(onCourt);
        const bad = reduce(game, { type: 'set_lineup', team: 'away', onCourt: ['away-1'] });
        expect(bad.away.onCourt).toEqual(onCourt);
    });
});

describe('replay and ignore', () => {
    it('replay matches a fold of reduce', () => {
        const events: ScoringEvent[] = [paintMake(), { type: 'timeout', team: 'home' }];
        expect(replay(SETUP, events)).toEqual(events.reduce(reduce, createGame(SETUP)));
    });

    it('ignores events after the game is over', () => {
        let game = createGame(SETUP);
        game = reduce(game, paintMake());
        game = { ...game, over: true };
        const frozen = reduce(game, paintMake({ team: 'home', shooterId: 'home-1' }));
        expect(frozen.score.home).toBe(0);
    });

    it('describes a make for the play-by-play', () => {
        const game = createGame(SETUP);
        expect(describeEvent(paintMake(), game)).toContain('make');
        expect(describeEvent({ type: 'period_end' }, game)).toBe('End Q1');
        expect(boxRows(reduce(game, paintMake()), 'away')[0]?.pts).toBe(2);
    });
});

describe('blocks and offensive fouls', () => {
    it('credits a block on a miss', () => {
        const game = reduce(createGame(SETUP), paintMake({ made: false, blockedById: 'home-1' }));
        expect(game.stats['home-1']?.blk).toBe(1);
    });

    it('offensive foul is a turnover', () => {
        const game = reduce(createGame(SETUP), {
            type: 'foul',
            team: 'away',
            playerId: 'away-1',
            offensive: true,
            clock: stamp(700),
        });
        expect(game.possession).toBe('home');
        expect(game.stats['away-1']?.tov).toBe(1);
        expect(game.teamFouls.away).toBe(0);
    });
});
