import type {CalEvent} from './types';

/** Keep the first event for each uid; later duplicates are dropped. */
export function dedupEvents(events: readonly CalEvent[]): CalEvent[] {
    const seen = new Set<string>();
    const out: CalEvent[] = [];
    for (const event of events) {
        if (seen.has(event.uid)) continue;
        seen.add(event.uid);
        out.push(event);
    }
    return out;
}
