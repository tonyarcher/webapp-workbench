export const HOME_POINT = {x: 50, y: 88};

export const FIELD_POS_POINTS: Record<number, {x: number; y: number}> = {
    1: {x: 50, y: 55},
    2: {x: 50, y: 85},
    3: {x: 72, y: 52},
    4: {x: 60, y: 38},
    5: {x: 28, y: 52},
    6: {x: 40, y: 38},
    7: {x: 20, y: 22},
    8: {x: 50, y: 15},
    9: {x: 80, y: 22},
};

export function hitEndpoint(fieldPos: number, eventType: string): {x: number; y: number} | null {
    const point = FIELD_POS_POINTS[fieldPos];
    if (!point) return null;
    if (eventType === 'HOME_RUN') {
        return {
            x: clamp(50 + (point.x - 50) * 1.25, 4, 96),
            y: Math.max(4, point.y - 10),
        };
    }
    return point;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}
