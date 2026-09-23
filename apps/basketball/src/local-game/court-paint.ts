import { restrictedArcPath, threePointJoin, threePointPath } from 'basketball-core';
import type { CourtSpec, Point } from 'basketball-core';
import { SCALE, courtToSvg } from './court-map';

export function threePointSvg(hoop: Point, spec: CourtSpec, side: 'left' | 'right'): string {
    const join = threePointJoin(spec);
    const offset = spec.threeCornerSidelineOffset;
    const baseline = side === 'left' ? 0 : spec.length;
    const along = side === 'left' ? hoop.x + join.along : hoop.x - join.along;
    const start = courtToSvg(baseline, offset);
    const lower = courtToSvg(along, offset);
    const upper = courtToSvg(along, spec.width - offset);
    const end = courtToSvg(baseline, spec.width - offset);
    const radius = spec.threeArcRadius * SCALE;
    const sweep = side === 'left' ? 1 : 0;
    return [
        `M ${start.x} ${start.y}`,
        `L ${lower.x} ${lower.y}`,
        `A ${radius} ${radius} 0 0 ${sweep} ${upper.x} ${upper.y}`,
        `L ${end.x} ${end.y}`,
    ].join(' ');
}

export function restrictedSvg(hoop: Point, spec: CourtSpec, side: 'left' | 'right'): string {
    const r = spec.restrictedRadius * SCALE;
    const top = courtToSvg(hoop.x, hoop.y - spec.restrictedRadius);
    const bot = courtToSvg(hoop.x, hoop.y + spec.restrictedRadius);
    const sweep = side === 'left' ? 1 : 0;
    return `M ${top.x} ${top.y} A ${r} ${r} 0 0 ${sweep} ${bot.x} ${bot.y}`;
}

/** Sanity: SVG path is a scaled copy of the core feet path command count. */
export function pathCommandCount(path: string): number {
    return path.split(/[MLAmlaz]/).length;
}

export function threePointCommandsMatch(hoop: Point, spec: CourtSpec, side: 'left' | 'right'): boolean {
    return pathCommandCount(threePointSvg(hoop, spec, side)) === pathCommandCount(threePointPath(hoop, spec, side));
}

export function restrictedCommandsMatch(hoop: Point, spec: CourtSpec, side: 'left' | 'right'): boolean {
    return pathCommandCount(restrictedSvg(hoop, spec, side)) === pathCommandCount(restrictedArcPath(hoop, spec, side));
}
