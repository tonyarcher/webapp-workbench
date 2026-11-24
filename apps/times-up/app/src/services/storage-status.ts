import type { StorageStatus } from './api-domains';

/** Pure projection of storage status, so the confirm path is testable without DOM. */
export function purgeAvailable(status: StorageStatus | null): boolean {
    return status?.purgeEnabled === true;
}

export function purgeResultLine(purged: number): string {
    return `Purged ${purged} old body object${purged === 1 ? '' : 's'}. Articles were not deleted.`;
}

export function storageSizeLine(bytes: number): string {
    return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
}
