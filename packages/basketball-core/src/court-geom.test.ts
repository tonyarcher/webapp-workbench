import { describe, expect, it } from 'vitest';
import {
    inBounds,
    isThreePoint,
    laneRect,
    leftHoop,
    offensiveHoop,
    restrictedArcPath,
    rightHoop,
    shotPoints,
    threePointJoin,
    threePointPath,
} from './court-geom';
import { NBA, NCAA, NFHS, WNBA } from './rulebook';

describe('isThreePoint', () => {
    it('NBA paint is two and above-the-break is three', () => {
        const hoop = leftHoop(NBA.court);
        expect(isThreePoint(hoop.x + 10, hoop.y, hoop, NBA.court)).toBe(false);
        expect(isThreePoint(hoop.x + NBA.court.threeArcRadius, hoop.y, hoop, NBA.court)).toBe(true);
        expect(isThreePoint(hoop.x + NBA.court.threeArcRadius - 0.2, hoop.y, hoop, NBA.court)).toBe(false);
    });

    it('NBA corner 22-foot line is three, inside is two', () => {
        const hoop = leftHoop(NBA.court);
        expect(isThreePoint(hoop.x, hoop.y - 22, hoop, NBA.court)).toBe(true);
        expect(isThreePoint(hoop.x, hoop.y - 21, hoop, NBA.court)).toBe(false);
    });

    it('HS 19-9 arc is shorter than NBA', () => {
        const hoop = leftHoop(NFHS.court);
        expect(isThreePoint(hoop.x + 20, hoop.y, hoop, NFHS.court)).toBe(true);
        expect(isThreePoint(hoop.x + 20, hoop.y, hoop, NBA.court)).toBe(false);
    });

    it('NCAA / WNBA use the FIBA arc at the top', () => {
        const ncaaHoop = leftHoop(NCAA.court);
        const wnbaHoop = leftHoop(WNBA.court);
        const top = NCAA.court.threeArcRadius;
        expect(isThreePoint(ncaaHoop.x + top, ncaaHoop.y, ncaaHoop, NCAA.court)).toBe(true);
        expect(isThreePoint(wnbaHoop.x + top, wnbaHoop.y, wnbaHoop, WNBA.court)).toBe(true);
        expect(isThreePoint(ncaaHoop.x + top - 0.3, ncaaHoop.y, ncaaHoop, NCAA.court)).toBe(false);
    });
});

describe('shotPoints', () => {
    it('misses are zero', () => {
        const hoop = leftHoop(NBA.court);
        expect(shotPoints(false, hoop.x + 30, hoop.y, hoop, NBA.court)).toBe(0);
        expect(shotPoints(true, hoop.x + 10, hoop.y, hoop, NBA.court)).toBe(2);
        expect(shotPoints(true, hoop.x + 30, hoop.y, hoop, NBA.court)).toBe(3);
    });
});

describe('court layout', () => {
    it('places hoops on both baselines', () => {
        expect(leftHoop(NBA.court)).toEqual({ x: 5.25, y: 25 });
        expect(rightHoop(NBA.court).x).toBe(NBA.court.length - 5.25);
        expect(inBounds(0, 0, NBA.court)).toBe(true);
        expect(inBounds(-1, 25, NBA.court)).toBe(false);
        expect(inBounds(50, 25, NFHS.court)).toBe(true);
        expect(inBounds(90, 25, NFHS.court)).toBe(false);
    });

    it('home attacks the right hoop to start', () => {
        expect(offensiveHoop(false, 'home', NBA.court)).toEqual(rightHoop(NBA.court));
        expect(offensiveHoop(false, 'away', NBA.court)).toEqual(leftHoop(NBA.court));
        expect(offensiveHoop(true, 'home', NBA.court)).toEqual(leftHoop(NBA.court));
    });

    it('builds a 3-point path that includes the arc radius', () => {
        const join = threePointJoin(NBA.court);
        expect(join.across).toBe(22);
        expect(join.along).toBeGreaterThan(8);
        const path = threePointPath(leftHoop(NBA.court), NBA.court, 'left');
        expect(path.startsWith('M 0 ')).toBe(true);
        expect(path.includes(`A ${NBA.court.threeArcRadius}`)).toBe(true);
        const right = threePointPath(rightHoop(NBA.court), NBA.court, 'right');
        expect(right.startsWith(`M ${NBA.court.length} `)).toBe(true);
        const lane = laneRect(NBA.court, 'left');
        expect(lane.width).toBe(19);
        expect(lane.height).toBe(16);
        expect(restrictedArcPath(leftHoop(NBA.court), NBA.court, 'left')).toContain('A 4 4');
    });
});
