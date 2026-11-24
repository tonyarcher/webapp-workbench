// Snapshot smoke: list rows stay metadata-only and open lazily through markers.
import { isSnapshotArticle, savedSnapshotToArticle } from '../src/services/saved-queue';
import { assert } from './smoke-assert';

const snapshot = savedSnapshotToArticle({
    id: 'row-1',
    articleId: 'a1',
    title: 'Saved',
    savedAt: 1_000,
    contentPending: true,
});
assert(snapshot.content === undefined, 'list snapshots do not carry a body');
assert(
    snapshot.snapshotSource?.kind === 'saved' && snapshot.snapshotSource.articleId === 'a1',
    'saved snapshots carry a lazy body source',
);
assert(isSnapshotArticle(snapshot), 'saved snapshots are read-only');

const local = savedSnapshotToArticle({ id: 'local', title: 'Link', savedAt: 1_000, content: '<p>x</p>' });
assert(local.snapshotSource === undefined, 'local shared links keep inline bodies');
assert(!isSnapshotArticle({ feedId: 'feed-1', snapshotSource: undefined }), 'ordinary articles remain writable');
