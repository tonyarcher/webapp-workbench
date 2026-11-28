// K2 overnight delta. A small local snapshot compares the current learned topic
// clusters with the last brief visit. No article text or reading history leaves
// the browser.

import { safeLocalStorage } from './local-storage';
import type { TopicCluster } from './api-clusters';

const SNAPSHOT_KEY = 'times-up:brief-clusters';

export interface BriefClusterSnapshot {
    visitedAt: number;
    clusters: Record<string, number>;
}

export interface BriefClusterDelta {
    newClusters: TopicCluster[];
    growingClusters: TopicCluster[];
}

export function parseBriefClusterSnapshot(raw: string | null): BriefClusterSnapshot | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<BriefClusterSnapshot> | null;
        if (!parsed || typeof parsed.visitedAt !== 'number' || !parsed.clusters || typeof parsed.clusters !== 'object')
            return null;
        const clusters: Record<string, number> = {};
        for (const [id, count] of Object.entries(parsed.clusters)) {
            if (typeof count === 'number' && Number.isInteger(count) && count >= 0) clusters[id] = count;
        }
        return { visitedAt: parsed.visitedAt, clusters };
    } catch {
        return null;
    }
}

export function loadBriefClusterSnapshot(storage?: Storage | null): BriefClusterSnapshot | null {
    const store = storage === undefined ? safeLocalStorage() : storage;
    try {
        return parseBriefClusterSnapshot(store?.getItem(SNAPSHOT_KEY) ?? null);
    } catch {
        return null;
    }
}

export function saveBriefClusterSnapshot(clusters: TopicCluster[], storage?: Storage | null, now = Date.now()): void {
    const store = storage === undefined ? safeLocalStorage() : storage;
    const snapshot: BriefClusterSnapshot = {
        visitedAt: now,
        clusters: Object.fromEntries(clusters.map((cluster) => [cluster.id, cluster.memberCount])),
    };
    try {
        store?.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch {
        // The next visit simply compares against the older snapshot.
    }
}

export function diffBriefClusters(current: TopicCluster[], previous: BriefClusterSnapshot | null): BriefClusterDelta {
    if (!previous) return { newClusters: current, growingClusters: [] };
    return {
        newClusters: current.filter((cluster) => previous.clusters[cluster.id] === undefined),
        growingClusters: current.filter((cluster) => {
            const before = previous.clusters[cluster.id];
            return before !== undefined && cluster.memberCount > before;
        }),
    };
}
