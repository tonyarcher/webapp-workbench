// D3 smoke: JSON/text archive parsing and import remap old folder/feed ids to
// the ids created in the destination account.
import { assert } from './smoke-assert';
import { importArchive, isArchiveFile, type ArchiveImportDeps } from '../src/services/archive-import';
import { archiveToText, buildArchive, parseArchive } from '../src/services/portable-export';
import type { Feed, Folder, SavedSearch } from '../src/types';
import type { MuteRule } from '../src/services/mute-rules';

const folders: Folder[] = [
    { id: 'f1', title: 'World', createdAt: 1 },
    { id: 'f2', title: 'Tech', createdAt: 2 },
];
const feeds: Feed[] = [
    { id: 'feed1', title: 'Reuters', url: 'https://example.com/feed', folderIds: ['f1'], unread: 0, addedAt: 1 },
];
const searches: SavedSearch[] = [
    { id: 's1', title: 'Battery', query: 'battery', scopeKind: 'folder', scopeId: 'f2', createdAt: 1, unread: 0 },
];
const rules: MuteRule[] = [
    { id: 'r1', terms: ['spam'], match: 'title', enabled: true, scope: { kind: 'folders', folderIds: ['f1'] } },
];
const archive = buildArchive(folders, feeds, searches, rules, new Date('2026-11-24T00:00:00Z'));

const json = parseArchive(JSON.stringify(archive));
assert(json !== null, 'JSON archive parses');
const text = parseArchive(archiveToText(archive));
assert(text !== null, 'text archive parses');
assert(parseArchive('{') === null, 'malformed JSON is rejected');
assert(parseArchive('version\t99\n') === null, 'unknown versions are rejected');
assert(isArchiveFile('archive.JSON'), 'uppercase JSON archives are recognized');
assert(isArchiveFile('archive.TXT'), 'uppercase text archives are recognized');
assert(!isArchiveFile('subscriptions.opml'), 'OPML files stay on the OPML path');

const memberships: Array<[string, string[]]> = [];
const createdSearches: Array<{ title: string; scopeId?: string }> = [];
const alerts: Array<[string, boolean]> = [];
let savedRules: MuteRule[] = [];
let folderIndex = 0;
let feedIndex = 0;
let searchIndex = 0;

const deps: ArchiveImportDeps = {
    addFolder: async () => ({ id: `new-folder-${++folderIndex}` }),
    addFeed: async () => ({ id: `new-feed-${++feedIndex}` }),
    setFeedFolders: async (feedId, folderIds) => {
        memberships.push([feedId, folderIds]);
    },
    createSavedSearch: async (title, _query, _scopeKind, scopeId) => {
        createdSearches.push({ title, ...(scopeId ? { scopeId } : {}) });
        return { id: `new-search-${++searchIndex}` };
    },
    setSavedSearchAlert: async (id, alert) => {
        alerts.push([id, alert]);
    },
    saveMuteRules: (next) => {
        savedRules = next;
    },
};

const result = await importArchive(archive, deps);
assert(
    result.folders === 2 && result.feeds === 1 && result.searches === 1 && result.rules === 1,
    'import counts each record',
);
assert(
    memberships[0]?.[0] === 'new-feed-1' && memberships[0]?.[1][0] === 'new-folder-1',
    'feed folders map to new ids',
);
assert(createdSearches[0]?.scopeId === 'new-folder-2', 'folder-scoped search maps to the new folder');
assert(savedRules[0]?.scope.kind === 'folders', 'folder-scoped mute survives');
assert(
    savedRules[0]?.scope.kind === 'folders' && savedRules[0].scope.folderIds[0] === 'new-folder-1',
    'mute scope maps to the new folder',
);

const legacy = {
    ...archive,
    folders: folders.map(({ title, createdAt }) => ({ title, createdAt })),
    feeds: archive.feeds.map((f) => ({ ...f, id: undefined })),
};
const legacyResult = await importArchive(legacy, deps);
assert(
    legacyResult.skipped === 2,
    `legacy scoped records without source ids are skipped (got ${legacyResult.skipped})`,
);
assert(legacyResult.feeds === 1, 'legacy feeds still import');

const malformed = {
    ...archive,
    savedSearches: [null, archive.savedSearches[0]],
    muteRules: [null, archive.muteRules[0]],
} as unknown as typeof archive;
const malformedResult = await importArchive(malformed, deps);
assert(malformedResult.skipped === 2, 'malformed search and mute entries are skipped');
assert(
    malformedResult.searches === 1 && malformedResult.rules === 1,
    'valid entries still import after malformed ones',
);

console.log('ok: portable archive parsing and id remapping');
