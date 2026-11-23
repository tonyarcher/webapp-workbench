// D3: JSON archive and line-separated text mirror of the reader's library.
import { ARCHIVE_VERSION, archiveToText, buildArchive, textToArchive } from '../src/services/portable-export';
import type { Feed, Folder, SavedSearch } from '../src/types';
import { assert } from './smoke-assert';

const folders: Folder[] = [
    { id: 'f1', title: 'World', createdAt: 1 },
    { id: 'f2', title: 'Tech, News', createdAt: 2 },
];
const feeds: Feed[] = [
    {
        id: 'feed1',
        title: 'Reuters',
        url: 'https://example.com/feed',
        folderIds: ['f1'],
        unread: 0,
        addedAt: 1,
    },
    {
        id: 'feed2',
        title: 'Verge',
        url: 'https://example.com/verge',
        siteUrl: 'https://example.com',
        folderIds: ['f2', 'f1'],
        unread: 0,
        addedAt: 2,
    },
];
const searches: SavedSearch[] = [
    {
        id: 's1',
        title: 'Battery',
        query: 'battery grid',
        scopeKind: 'folder',
        scopeId: 'f2',
        createdAt: 1,
        unread: 0,
        alert: true,
    },
];

const archive = buildArchive(folders, feeds, searches, [], new Date('2026-11-23T00:00:00Z'));

assert(archive.version === ARCHIVE_VERSION, 'archive is versioned');
assert(archive.folders.length === 2 && archive.feeds.length === 2, 'archive holds folders and feeds');
assert(archive.feeds[0]?.folders[0] === 'World', 'folder ids become titles');
assert(archive.savedSearches[0]?.alert === true, 'alert flag survives the archive');
const json = JSON.stringify(archive);
assert(JSON.parse(json).feeds[1].siteUrl === 'https://example.com', 'JSON round trip keeps siteUrl');

const text = archiveToText(archive);
assert(text.split('\n').filter(Boolean)[0]?.startsWith('version\t') === true, 'text format is line separated');
assert(text.includes('folder\tTech\\, News'), 'text escapes commas in a title');
assert(text.includes('feed\tVerge'), 'text holds one feed per line');
const parsed = textToArchive(text);
assert(parsed !== null, 'text archive parses');
assert(parsed?.folders[1]?.title === 'Tech, News', 'escaped commas survive text round trip');
assert(parsed?.feeds[1]?.folders.join(',') === 'Tech, News,World', 'multi-folder feed survives text');
assert(parsed?.savedSearches[0]?.alert === true, 'text keeps the alert flag');
assert(textToArchive('version\t99\n') === null, 'unknown versions are rejected');
