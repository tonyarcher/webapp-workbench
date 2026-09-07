export type Handedness = 'L' | 'R';

export type PlateResult = 'BALL' | 'STRIKE' | 'FOUL' | 'IN PLAY' | 'OUT';

export interface ParsedPlatePlay {
    eventType: string;
    bats: Handedness;
    throws: Handedness;
    result: PlateResult | '';
    swinging: boolean;
    fieldPos: number | null;
    zone: number | null;
}

const BALL_TYPES = new Set(['BALL', 'WALK', 'HIT_BY_PITCH', 'WILD_PITCH', 'PASSED_BALL', 'BALK']);
const STRIKE_TYPES = new Set(['STRIKE']);
const FOUL_TYPES = new Set(['FOUL']);
const IN_PLAY_TYPES = new Set(['SINGLE', 'DOUBLE', 'TRIPLE', 'HOME_RUN', 'ERROR', 'FIELDER_CHOICE']);
const OUT_TYPES = new Set([
    'STRIKEOUT',
    'GROUNDOUT',
    'FLYOUT',
    'LINE_OUT',
    'POP_OUT',
    'SACRIFICE_FLY',
    'SACRIFICE_BUNT',
    'CAUGHT_STEALING',
]);
const BATTED_TYPES = new Set([
    'SINGLE',
    'DOUBLE',
    'TRIPLE',
    'HOME_RUN',
    'ERROR',
    'FIELDER_CHOICE',
    'GROUNDOUT',
    'FLYOUT',
    'LINE_OUT',
    'POP_OUT',
    'SACRIFICE_FLY',
    'SACRIFICE_BUNT',
]);
const SWING_TYPES = new Set([...BATTED_TYPES, 'FOUL', 'STRIKEOUT']);

export function plateResultLabel(eventType: string): PlateResult | '' {
    if (BALL_TYPES.has(eventType)) return 'BALL';
    if (STRIKE_TYPES.has(eventType)) return 'STRIKE';
    if (FOUL_TYPES.has(eventType)) return 'FOUL';
    if (IN_PLAY_TYPES.has(eventType)) return 'IN PLAY';
    if (OUT_TYPES.has(eventType)) return 'OUT';
    return '';
}

export function isBattedBall(eventType: string): boolean {
    return BATTED_TYPES.has(eventType);
}

export function asHand(value: unknown, fallback: Handedness = 'R'): Handedness {
    return value === 'L' || value === 'R' ? value : fallback;
}

export function parsePlatePlay(
    json: string,
    fallbackBats: Handedness = 'R',
    fallbackThrows: Handedness = 'R'
): ParsedPlatePlay | null {
    if (!json) return null;
    try {
        const parsed = JSON.parse(json) as unknown;
        if (typeof parsed !== 'object' || parsed === null) return null;
        return playFromRecord(parsed as Record<string, unknown>, fallbackBats, fallbackThrows);
    } catch {
        return null;
    }
}

function playFromRecord(
    record: Record<string, unknown>,
    fallbackBats: Handedness,
    fallbackThrows: Handedness
): ParsedPlatePlay {
    const eventType = String(record.eventType ?? '');
    const strikeKind = String(record.strikeKind ?? '');
    const swinging = strikeKind === 'looking' ? false : strikeKind === 'swinging' ? true : SWING_TYPES.has(eventType);
    return {
        eventType,
        bats: asHand(record.bats, fallbackBats),
        throws: asHand(record.throws, fallbackThrows),
        result: plateResultLabel(eventType),
        swinging,
        fieldPos: boundedInt(record.fieldPos, 1, 9),
        zone: boundedInt(zoneValue(record.pitchLocation), 1, 9),
    };
}

function zoneValue(location: unknown): unknown {
    if (typeof location !== 'object' || location === null) return location;
    return (location as {zone?: unknown}).zone;
}

function boundedInt(value: unknown, min: number, max: number): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    if (rounded < min || rounded > max) return null;
    return rounded;
}
