import { describe, expect, it } from 'vitest';
import { NBA, NFHS, leftHoop, rightHoop } from 'basketball-core';
import { restrictedCommandsMatch, threePointCommandsMatch, threePointSvg } from './court-paint';

describe('court-paint', () => {
    it('keeps the same 3-point command structure as core', () => {
        expect(threePointCommandsMatch(leftHoop(NBA.court), NBA.court, 'left')).toBe(true);
        expect(threePointCommandsMatch(rightHoop(NFHS.court), NFHS.court, 'right')).toBe(true);
        expect(restrictedCommandsMatch(leftHoop(NBA.court), NBA.court, 'left')).toBe(true);
        expect(threePointSvg(leftHoop(NBA.court), NBA.court, 'left').startsWith('M ')).toBe(true);
        expect(restrictedCommandsMatch(rightHoop(NBA.court), NBA.court, 'right')).toBe(true);
    });
});
