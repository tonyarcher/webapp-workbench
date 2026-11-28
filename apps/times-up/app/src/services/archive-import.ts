// D3 archive import. Rebuild folders, feeds, saved searches, and mute rules
// from the portable JSON/text archive. API calls are injected so the mapping
// and failure handling stay testable under the Node smoke harness.

import type { MuteRule } from './mute-rules';
import type { LibraryArchive } from './portable-export';

export interface ArchiveImportResult {
    folders: number;
    feeds: number;
    searches: number;
    rules: number;
    skipped: number;
}

export function isArchiveFile(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.endsWith('.json') || lower.endsWith('.txt');
}

export interface ArchiveImportDeps {
    addFolder(title: string): Promise<{ id: string }>;
    addFeed(url: string): Promise<{ id: string }>;
    setFeedFolders(feedId: string, folderIds: string[]): Promise<void>;
    createSavedSearch(title: string, query: string, scopeKind: string, scopeId?: string): Promise<{ id: string }>;
    setSavedSearchAlert(id: string, alert: boolean): Promise<void>;
    saveMuteRules(rules: MuteRule[]): void;
}

interface IdMaps {
    foldersByOldId: Map<string, string>;
    foldersByTitle: Map<string, string>;
    feedsByOldId: Map<string, string>;
}

async function importFolders(archive: LibraryArchive, deps: ArchiveImportDeps, result: ArchiveImportResult) {
    const maps: IdMaps = { foldersByOldId: new Map(), foldersByTitle: new Map(), feedsByOldId: new Map() };
    for (const folder of archive.folders) {
        try {
            const created = await deps.addFolder(folder.title);
            if (folder.id) maps.foldersByOldId.set(folder.id, created.id);
            maps.foldersByTitle.set(folder.title, created.id);
            result.folders += 1;
        } catch {
            result.skipped += 1;
        }
    }
    return maps;
}

async function importFeeds(
    archive: LibraryArchive,
    maps: IdMaps,
    deps: ArchiveImportDeps,
    result: ArchiveImportResult,
) {
    for (const feed of archive.feeds) {
        try {
            const created = await deps.addFeed(feed.url);
            if (feed.id) maps.feedsByOldId.set(feed.id, created.id);
            const folderIds = feed.folders
                .map((title) => maps.foldersByTitle.get(title))
                .filter((id): id is string => !!id);
            if (folderIds.length) await deps.setFeedFolders(created.id, folderIds);
            result.feeds += 1;
        } catch {
            result.skipped += 1;
        }
    }
}

function scopeIdFor(scopeKind: string, scopeId: string | undefined, maps: IdMaps): string | undefined {
    if (!scopeId) return undefined;
    if (scopeKind === 'folder') return maps.foldersByOldId.get(scopeId);
    if (scopeKind === 'feed') return maps.feedsByOldId.get(scopeId);
    return undefined;
}

async function importSearches(
    archive: LibraryArchive,
    maps: IdMaps,
    deps: ArchiveImportDeps,
    result: ArchiveImportResult,
) {
    for (const candidate of archive.savedSearches as unknown[]) {
        try {
            if (!candidate || typeof candidate !== 'object') {
                result.skipped += 1;
                continue;
            }
            const search = candidate as Record<string, unknown>;
            if (
                typeof search['title'] !== 'string' ||
                typeof search['query'] !== 'string' ||
                typeof search['scopeKind'] !== 'string' ||
                (search['scopeId'] != null && typeof search['scopeId'] !== 'string')
            ) {
                result.skipped += 1;
                continue;
            }
            const scopeId = scopeIdFor(search['scopeKind'], search['scopeId'] as string | undefined, maps);
            if (search['scopeId'] && !scopeId) {
                result.skipped += 1;
                continue;
            }
            const created = await deps.createSavedSearch(
                search['title'],
                search['query'],
                search['scopeKind'],
                scopeId,
            );
            if (search['alert'] === true) await deps.setSavedSearchAlert(created.id, true);
            result.searches += 1;
        } catch {
            result.skipped += 1;
        }
    }
}

function validMuteRule(value: unknown): value is MuteRule {
    if (!value || typeof value !== 'object') return false;
    const rule = value as Record<string, unknown>;
    const scope = rule['scope'] as Record<string, unknown> | null;
    return (
        typeof rule['id'] === 'string' &&
        Array.isArray(rule['terms']) &&
        rule['terms'].every((term) => typeof term === 'string') &&
        (rule['match'] === 'title' || rule['match'] === 'body' || rule['match'] === 'either') &&
        typeof rule['enabled'] === 'boolean' &&
        !!scope &&
        (scope['kind'] === 'all' ||
            (scope['kind'] === 'folders' &&
                Array.isArray(scope['folderIds']) &&
                scope['folderIds'].every((id) => typeof id === 'string')))
    );
}

function importMuteRules(archive: LibraryArchive, maps: IdMaps, deps: ArchiveImportDeps, result: ArchiveImportResult) {
    const rules: MuteRule[] = [];
    for (const candidate of archive.muteRules as unknown[]) {
        try {
            if (!validMuteRule(candidate)) {
                result.skipped += 1;
                continue;
            }
            if (candidate.scope.kind === 'folders') {
                const folderIds = candidate.scope.folderIds
                    .map((id) => maps.foldersByOldId.get(id))
                    .filter((id): id is string => !!id);
                if (folderIds.length !== candidate.scope.folderIds.length) {
                    result.skipped += 1;
                    continue;
                }
                rules.push({ ...candidate, scope: { kind: 'folders', folderIds } });
            } else {
                rules.push(candidate);
            }
        } catch {
            result.skipped += 1;
        }
    }
    deps.saveMuteRules(rules);
    result.rules = rules.length;
}

export async function importArchive(archive: LibraryArchive, deps: ArchiveImportDeps): Promise<ArchiveImportResult> {
    const result: ArchiveImportResult = { folders: 0, feeds: 0, searches: 0, rules: 0, skipped: 0 };
    const maps = await importFolders(archive, deps, result);
    await importFeeds(archive, maps, deps, result);
    await importSearches(archive, maps, deps, result);
    importMuteRules(archive, maps, deps, result);
    return result;
}
