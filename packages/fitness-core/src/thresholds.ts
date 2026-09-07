import type {ThresholdComparator} from './types';

export function evaluateThreshold(
    value: number,
    comparator: ThresholdComparator,
    threshold: number,
): boolean {
    switch (comparator) {
        case 'lt':
            return value < threshold;
        case 'lte':
            return value <= threshold;
        case 'gt':
            return value > threshold;
        case 'gte':
            return value >= threshold;
    }
}

/** Inclusive start, exclusive end. `endedOn` null means open-ended. Dates are YYYY-MM-DD. */
export function phaseOverlapsRange(
    startedOn: string,
    endedOn: string | null,
    rangeStartMs: number,
    rangeEndMs: number,
): boolean {
    const start = Date.parse(`${startedOn}T00:00:00Z`);
    const end = endedOn ? Date.parse(`${endedOn}T00:00:00Z`) : Number.POSITIVE_INFINITY;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return start < rangeEndMs && end > rangeStartMs;
}
