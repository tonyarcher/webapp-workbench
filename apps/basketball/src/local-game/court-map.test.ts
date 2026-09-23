import { describe, expect, it } from 'vitest';
import { NBA } from 'basketball-core';
import { clientToCourt, courtToSvg, svgToCourt, viewSize } from './court-map';

describe('court-map', () => {
    it('round-trips a paint touch', () => {
        const point = { x: 10, y: 25 };
        const svg = courtToSvg(point.x, point.y);
        expect(svgToCourt(svg.x, svg.y, NBA.court)).toEqual(point);
    });

    it('rejects out of bounds', () => {
        expect(svgToCourt(0, 0, NBA.court)).toBeNull();
        expect(clientToCourt(0, 0, { left: 0, top: 0, width: 0, height: 100 }, NBA.court)).toBeNull();
        const size = viewSize(NBA.court);
        const svg = courtToSvg(10, 25);
        const hit = clientToCourt(svg.x, svg.y, { left: 0, top: 0, width: size.width, height: size.height }, NBA.court);
        expect(hit?.x).toBeCloseTo(10);
        expect(hit?.y).toBeCloseTo(25);
    });
});
