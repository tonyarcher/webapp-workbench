import type {CourtSpec, Point, TeamId} from './types';

export function leftHoop(spec: CourtSpec): Point {
    return {x: spec.hoopFromBaseline, y: spec.width / 2};
}

export function rightHoop(spec: CourtSpec): Point {
    return {x: spec.length - spec.hoopFromBaseline, y: spec.width / 2};
}

export function offensiveHoop(homeAttacksLeft: boolean, possession: TeamId, spec: CourtSpec): Point {
    const attacksLeft = possession === 'home' ? homeAttacksLeft : !homeAttacksLeft;
    return attacksLeft ? leftHoop(spec) : rightHoop(spec);
}

export function threePointJoin(spec: CourtSpec): {along: number; across: number} {
    const across = spec.width / 2 - spec.threeCornerSidelineOffset;
    const radius = spec.threeArcRadius;
    const along = Math.sqrt(Math.max(0, radius * radius - across * across));
    return {along, across};
}

export function isThreePoint(x: number, y: number, hoop: Point, spec: CourtSpec): boolean {
    const along = x - hoop.x;
    const across = y - hoop.y;
    const dist = Math.hypot(along, across);
    const cornerAcross = spec.width / 2 - spec.threeCornerSidelineOffset;
    if (Math.abs(across) >= cornerAcross - 1e-9) {
        return dist >= spec.threeCornerDistance;
    }
    return dist >= spec.threeArcRadius;
}

export function shotPoints(made: boolean, x: number, y: number, hoop: Point, spec: CourtSpec): 0 | 2 | 3 {
    if (!made) return 0;
    return isThreePoint(x, y, hoop, spec) ? 3 : 2;
}

export function inBounds(x: number, y: number, spec: CourtSpec): boolean {
    return x >= 0 && x <= spec.length && y >= 0 && y <= spec.width;
}

/** Open 3-point line: corner stems to the baseline plus the arc. */
export function threePointPath(hoop: Point, spec: CourtSpec, side: 'left' | 'right'): string {
    const join = threePointJoin(spec);
    const offset = spec.threeCornerSidelineOffset;
    const baseline = side === 'left' ? 0 : spec.length;
    const along = side === 'left' ? hoop.x + join.along : hoop.x - join.along;
    const sweep = side === 'left' ? 1 : 0;
    const r = spec.threeArcRadius;
    return [
        `M ${baseline} ${offset}`,
        `L ${along} ${offset}`,
        `A ${r} ${r} 0 0 ${sweep} ${along} ${spec.width - offset}`,
        `L ${baseline} ${spec.width - offset}`,
    ].join(' ');
}

export function laneRect(spec: CourtSpec, side: 'left' | 'right'): {x: number; y: number; width: number; height: number} {
    const height = spec.laneWidth;
    const y = (spec.width - height) / 2;
    if (side === 'left') return {x: 0, y, width: spec.ftLineFromBaseline, height};
    return {
        x: spec.length - spec.ftLineFromBaseline,
        y,
        width: spec.ftLineFromBaseline,
        height,
    };
}

export function restrictedArcPath(hoop: Point, spec: CourtSpec, side: 'left' | 'right'): string {
    const r = spec.restrictedRadius;
    const sweep = side === 'left' ? 1 : 0;
    return `M ${hoop.x} ${hoop.y - r} A ${r} ${r} 0 0 ${sweep} ${hoop.x} ${hoop.y + r}`;
}
