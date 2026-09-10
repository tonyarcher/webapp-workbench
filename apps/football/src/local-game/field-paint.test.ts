import {describe, expect, it} from 'vitest';
import type {Play, Situation} from 'football-core';
import {FIELD_HEIGHT, FIELD_WIDTH, fgTarget, kickAim, playFlight} from './field-geom';
import {paintFieldSvg, playPath} from './field-paint';

const situation: Situation = {
    down: 1,
    distance: 10,
    yardline100: 70,
    hash: 'middle',
    possession: 'home',
};

function paint(extra: Partial<Parameters<typeof paintFieldSvg>[0]> = {}): string {
    return paintFieldSvg({
        situation,
        homeName: 'Home',
        awayName: 'Away',
        trailPath: '',
        trailKind: null,
        fgPath: '',
        fgKey: 0,
        animateFg: false,
        ...extra,
    });
}

function fgPlay(id: string, made: boolean): Play {
    return {
        id,
        driveId: 'd1',
        period: 1,
        clock: {snap: 700, dead: 694, playClockAtSnap: 40, stopReason: 'score'},
        situation,
        personnel: {offense: [], defense: [], grouping: ''},
        call: {family: 'field_goal', concept: 'unknown', formation: ''},
        events: [],
        result: {
            yards: 0,
            firstDown: false,
            scoring: made ? 'field_goal' : undefined,
            deadAtYardline100: 0,
            outOfBounds: false,
            incomplete: false,
            sack: false,
        },
        tacklers: [],
    };
}

describe('paintFieldSvg', () => {
    it('emits a real SVG with a yard line on every 5 yards', () => {
        const markup = paint();
        expect(markup).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(markup.match(/class="yl"/g)).toHaveLength(19);
        expect(markup.match(/class="gl"/g)).toHaveLength(2);
        expect(markup.match(/class="num"/g)).toHaveLength(18);
        expect(markup.match(/class="posts"/g)).toHaveLength(2);
        expect(markup).toContain('>50<');
        expect(markup).toContain('>10<');
    });

    it('keeps markers, numbers, and overlays at readable sizes', () => {
        const markup = paint();
        expect(markup).toContain('font-size="30"');
        expect(markup).toContain('dominant-baseline="middle"');

        const strokes = [...markup.matchAll(/stroke-width="([\d.]+)"/g)].map((m) => Number(m[1]));
        expect(Math.max(...strokes)).toBeLessThanOrEqual(6);
        const radii = [...markup.matchAll(/ r="([\d.]+)"/g)].map((m) => Number(m[1]));
        expect(Math.max(...radii)).toBeLessThanOrEqual(16);
    });

    it('lines the top and bottom numbers inside the sidelines', () => {
        const all = [...paint().matchAll(/class="num" x="\d+" y="([\d.]+)"/g)].map((m) => Number(m[1]));
        expect(all).toHaveLength(18);
        const tops = all.filter((_, i) => i % 2 === 0);
        const bottoms = all.filter((_, i) => i % 2 === 1);
        expect(tops.every((y) => y === 30)).toBe(true);
        expect(bottoms.every((y) => y === 503)).toBe(true);
        expect(Math.max(...bottoms)).toBeLessThan(FIELD_HEIGHT);
    });

    it('keeps a run trail and spots the ball without a flight animation', () => {
        const markup = paint({
            trailPath: 'M 400 266 L 520 266',
            trailKind: 'run',
        });
        expect(markup).toContain('class="trail"');
        expect(markup).toContain('M 400 266 L 520 266');
        expect(markup).toContain('markerUnits="userSpaceOnUse"');
        expect(markup).toContain('class="ball idle"');
        expect(markup).not.toContain('animateMotion');
    });

    it('animates only a field-goal kick along the posts', () => {
        const markup = paint({
            fgPath: 'M 400 266 Q 800 266 1250 266',
            animateFg: true,
            fgKey: 3,
        });
        expect(markup).toContain('animateMotion');
        expect(markup).toContain('M 400 266 Q 800 266 1250 266');
        expect(markup).not.toContain('class="ball idle"');
    });

    it('escapes end-zone names', () => {
        const markup = paint({homeName: 'A&B <C>'});
        expect(markup).toContain('A&amp;B &lt;C&gt;');
        expect(markup).not.toContain('A&B <C>');
    });
});

describe('playPath', () => {
    it('draws a run as a straight horizontal line', () => {
        expect(playPath({
            kind: 'run',
            fromX: 100,
            toX: 200,
            fromY: 50,
            toY: 50,
        })).toBe('M 100 50 L 200 50');
    });

    it('sends a made field goal through the posts', () => {
        const flight = playFlight(fgPlay('p-good', true));
        expect(flight).toEqual(expect.objectContaining({
            kind: 'fg',
            aim: 'through',
            toY: FIELD_HEIGHT / 2,
        }));
        if (!flight) return;
        expect(flight.toX).toBeGreaterThan(FIELD_WIDTH);
        expect(playPath(flight)).toContain(` ${flight.toX} `);
    });
});

describe('kickAim', () => {
    it('goes through on a make and wide on a miss', () => {
        expect(kickAim(fgPlay('p-good', true))).toBe('through');
        const miss = kickAim(fgPlay('p-miss', false));
        expect(miss === 'left' || miss === 'right').toBe(true);
        const {toY} = fgTarget(400, FIELD_HEIGHT / 2, 'home', miss);
        expect(toY).not.toBe(FIELD_HEIGHT / 2);
    });
});
