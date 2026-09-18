import {describe, expect, it} from 'vitest';
import {boxRows} from './box-score';
import {laneRect, restrictedArcPath, rightHoop} from './court-geom';
import {generateRoster} from './default-roster';
import {describeEvent} from './notation';
import {createGame, currentStamp, reduce} from './reduce';
import {NBA} from './rulebook';
import type {ClockStamp, GameSetup, ShotEvent} from './types';

const SETUP: GameSetup = {
    homeName: 'Home',
    awayName: 'Away',
    rulebookId: 'nba',
    openingPossession: 'away',
};

function stamp(gameClockSeconds: number, shotClockSeconds = 24, period = 1): ClockStamp {
    return {period, gameClockSeconds, shotClockSeconds};
}

function paint(overrides: Partial<ShotEvent> = {}): ShotEvent {
    return {
        type: 'shot',
        team: 'away',
        shooterId: 'away-1',
        xFeet: 13,
        yFeet: 25,
        made: true,
        clock: stamp(700),
        ...overrides,
    };
}

describe('remaining branches', () => {
    it('uses a custom lineup and falls back when the five is illegal', () => {
        const homeRoster = generateRoster('home');
        const awayRoster = generateRoster('away');
        const onCourt = ['away-3', 'away-4', 'away-12', 'away-22', 'away-33'];
        const game = createGame({
            ...SETUP,
            homeRoster,
            awayRoster,
            homeOnCourt: ['nope'],
            awayOnCourt: onCourt,
        });
        expect(game.away.onCourt).toEqual(onCourt);
        expect(game.home.onCourt).toEqual(homeRoster.slice(0, 5).map((p) => p.id));
        expect(currentStamp(game).period).toBe(1);
    });

    it('covers no-op guards', () => {
        const start = createGame(SETUP);
        expect(reduce(start, {type: 'set_clock', clock: {period: 0, gameClockSeconds: 1, shotClockSeconds: 1}})).toBe(start);
        expect(reduce(start, paint({clock: stamp(-1)}))).toBe(start);
        expect(reduce(start, paint({team: 'home', shooterId: 'home-1'}))).toBe(start);
        expect(reduce(start, {type: 'turnover', team: 'home', playerId: 'home-1', clock: stamp(700)})).toBe(start);
        expect(reduce(start, {type: 'turnover', team: 'away', playerId: 'away-3', clock: stamp(700)})).toBe(start);
        expect(reduce(start, {type: 'turnover', team: 'away', playerId: 'away-1', clock: stamp(-1)})).toBe(start);
        expect(reduce(start, {type: 'foul', team: 'away', playerId: 'away-1', clock: stamp(-1)})).toBe(start);
        expect(reduce(start, {type: 'foul', team: 'away', playerId: 'away-3', clock: stamp(700)})).toBe(start);
        expect(reduce(start, {
            type: 'rebound',
            team: 'away',
            playerId: 'away-1',
            offensive: false,
            clock: stamp(-1),
        })).toBe(start);
        expect(reduce(start, {
            type: 'rebound',
            team: 'away',
            playerId: 'away-3',
            offensive: false,
            clock: stamp(700),
        })).toBe(start);
        expect(reduce(start, {type: 'substitution', team: 'home', outId: 'home-1', inId: 'ghost'})).toBe(start);
        expect(reduce(start, {type: 'free_throw', shooterId: 'away-1', made: true, clock: stamp(700)})).toBe(start);
    });

    it('continues a two-shot bonus and ignores a self-assist', () => {
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
        const first = reduce(game, {type: 'free_throw', shooterId: 'away-1', made: true, clock: stamp(700)});
        expect(first.pendingFt?.remaining).toBe(1);
        const blocked = reduce(createGame(SETUP), paint({made: false, blockedById: 'home-3'}));
        expect(blocked.stats['home-3']?.blk).toBe(0);
        const self = reduce(createGame(SETUP), paint({assistId: 'away-1'}));
        expect(self.stats['away-1']?.ast).toBe(0);
        const shooting = reduce(createGame(SETUP), {
            type: 'foul',
            team: 'home',
            playerId: 'home-1',
            fouledId: 'away-1',
            shooting: true,
            clock: stamp(700),
        });
        expect(shooting.pendingFt?.remaining).toBe(2);
        expect(shooting.pendingFt?.shooterId).toBe('away-1');
        const duringFt = reduce(shooting, {
            type: 'rebound',
            team: 'away',
            playerId: 'away-1',
            offensive: true,
            clock: stamp(700),
        });
        expect(duringFt.pendingFt?.remaining).toBe(2);
        expect(reduce(shooting, {
            type: 'foul',
            team: 'home',
            playerId: 'home-1',
            fouledId: 'away-1',
            clock: stamp(700),
        }).pendingFt?.remaining).toBe(2);
        const benchFoul = reduce(createGame(SETUP), {
            type: 'foul',
            team: 'home',
            playerId: 'home-1',
            fouledId: 'away-3',
            clock: stamp(700),
        });
        expect(benchFoul.teamFouls.home).toBe(1);
        expect(benchFoul.pendingFt).toBeNull();
    });

    it('three-point shooting foul is three free throws', () => {
        const game = reduce(createGame(SETUP), paint({
            made: false,
            shootingFoul: true,
            xFeet: 36,
            yFeet: 25,
        }));
        expect(game.pendingFt?.remaining).toBe(3);
        expect(reduce(game, paint()).pendingFt?.remaining).toBe(3);
        const missFt = reduce(game, {type: 'free_throw', shooterId: 'away-1', made: false, clock: stamp(700)});
        expect(missFt.pendingFt?.remaining).toBe(2);
        expect(reduce(game, {type: 'free_throw', shooterId: 'away-1', made: true, clock: stamp(-1)})).toBe(game);
    });

    it('away timeout, home sub, steal copy, and missing box row', () => {
        let game = reduce(createGame(SETUP), {type: 'timeout', team: 'away'});
        expect(game.away.timeouts).toBe(6);
        game = reduce(game, {type: 'substitution', team: 'home', outId: 'home-1', inId: 'home-3'});
        expect(game.home.onCourt.includes('home-3')).toBe(true);
        game = reduce(game, {
            type: 'set_lineup',
            team: 'home',
            onCourt: ['home-1', 'home-2', 'home-11', 'home-21', 'home-32'],
        });
        expect(game.home.onCourt[0]).toBe('home-1');
        const steal = describeEvent({
            type: 'turnover',
            team: 'away',
            playerId: 'away-1',
            stealPlayerId: 'home-1',
            clock: stamp(700),
        }, game);
        expect(steal).toContain('steal');
        const ghost = describeEvent({
            type: 'foul',
            team: 'home',
            playerId: 'missing',
            clock: stamp(700),
        }, game);
        expect(ghost).toContain('missing');
        const stripped = {...game, stats: {}};
        expect(boxRows(stripped, 'home')[0]?.playerId).toBe('home-1');
        const stealTurnover = reduce(createGame(SETUP), {
            type: 'turnover',
            team: 'away',
            playerId: 'away-1',
            stealPlayerId: 'home-3',
            clock: stamp(700),
        });
        expect(stealTurnover.stats['home-3']?.stl).toBe(0);
        const duringFt = reduce(reduce(createGame(SETUP), paint({shootingFoul: true})), {
            type: 'turnover',
            team: 'away',
            playerId: 'away-1',
            clock: stamp(700),
        });
        expect(duringFt.pendingFt).not.toBeNull();
    });

    it('keeps HS team fouls through Q1 and credits minutes', () => {
        let game = createGame({...SETUP, rulebookId: 'nfhs'});
        game = reduce(game, {
            type: 'foul',
            team: 'home',
            playerId: 'home-1',
            clock: stamp(400, 35),
        });
        game = reduce(game, {type: 'period_end'});
        expect(game.clock.period).toBe(2);
        expect(game.teamFouls.home).toBe(1);
        game = reduce(createGame(SETUP), {type: 'set_clock', clock: stamp(600)});
        expect(game.stats['away-1']?.seconds).toBe(120);
        const right = laneRect(NBA.court, 'right');
        expect(right.x).toBe(NBA.court.length - 19);
        expect(restrictedArcPath(rightHoop(NBA.court), NBA.court, 'right')).toContain('0 0 0');
    });
});
