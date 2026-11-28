// K3 section expansion state. Local only: the briefing remembers which source
// lists the reader opened, without sending interaction history to the server.

import { safeLocalStorage } from './local-storage';

const KEY = 'times-up:brief-expanded-sections';

export function loadExpandedBriefSections(storage?: Storage | null): Set<string> {
    const store = storage === undefined ? safeLocalStorage() : storage;
    try {
        const parsed = JSON.parse(store?.getItem(KEY) ?? '[]') as unknown;
        return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
    } catch {
        return new Set();
    }
}

export function saveExpandedBriefSections(ids: ReadonlySet<string>, storage?: Storage | null): void {
    const store = storage === undefined ? safeLocalStorage() : storage;
    try {
        store?.setItem(KEY, JSON.stringify([...ids]));
    } catch {
        // Expansion is a convenience; the current page still keeps its state.
    }
}

export function toggleBriefSection(ids: ReadonlySet<string>, id: string): Set<string> {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
}
