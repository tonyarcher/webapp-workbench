// B6 smoke: per-folder catch-up budgets, one-step undo, and budget filling.
import { assert } from './smoke-assert';
import { memoryStorage } from './smoke-storage';
import {
    DEFAULT_CATCH_UP_BUDGET,
    clearCatchUpUndo,
    consumeCatchUpUndo,
    loadCatchUpBudget,
    peekCatchUpUndo,
    rememberCatchUpUndo,
    saveCatchUpBudget,
} from '../src/services/catch-up';
import { pickCatchUpKeep } from '../src/web-components/article-list/article-list-catch-up';
import type { Article, View } from '../src/types';

const folder: View = { kind: 'folder', id: 'folder-a' };
const other: View = { kind: 'folder', id: 'folder-b' };
const store = memoryStorage();

assert(loadCatchUpBudget(folder, store) === DEFAULT_CATCH_UP_BUDGET, 'a folder starts with the default budget');
saveCatchUpBudget(folder, 15, store);
assert(loadCatchUpBudget(folder, store) === 15, 'the budget persists per folder');
assert(loadCatchUpBudget(other, store) === DEFAULT_CATCH_UP_BUDGET, 'another folder keeps its own default');
saveCatchUpBudget(folder, 7, store);
assert(loadCatchUpBudget(folder, store) === 15, 'an unsupported budget is ignored');

clearCatchUpUndo();
rememberCatchUpUndo(folder, ['a', 'b']);
assert(peekCatchUpUndo(folder)?.ids.length === 2, 'the undo snapshot remembers the batch');
assert(peekCatchUpUndo(other) === null, 'another folder cannot see or undo the batch');
const snapshot = peekCatchUpUndo(folder);
assert(snapshot !== null && consumeCatchUpUndo(folder, snapshot.id), 'undo consumes the scoped batch once');
assert(consumeCatchUpUndo(folder, snapshot?.id ?? 0) === false, 'a second undo has nothing to restore');
rememberCatchUpUndo(folder, ['c']);
const newer = peekCatchUpUndo(folder);
assert(
    newer !== null && !consumeCatchUpUndo(folder, (snapshot?.id ?? 0) + 100),
    'a stale token cannot consume a newer batch',
);
assert(peekCatchUpUndo(folder)?.ids[0] === 'c', 'the newer batch stays available');
clearCatchUpUndo();
assert(peekCatchUpUndo(folder) === null, 'sign-out clearing removes the snapshot');

function article(id: string, interest: number, words: number): Article {
    return {
        id,
        read: 0,
        scores: { interest },
        content: Array.from({ length: words }, () => 'word').join(' '),
        summary: '',
    } as Article;
}

const unread = [article('low', 0.1, 400), article('high', 0.9, 400), article('middle', 0.5, 400)];
const keep = pickCatchUpKeep(unread, 5);
assert(keep.has('high'), 'the highest-interest article is kept first');
assert(keep.has('middle'), 'the next article fits the remaining budget');
assert(!keep.has('low'), 'the article outside the minute budget is marked read');
assert(pickCatchUpKeep(unread, 1).size === 0, 'a budget shorter than one article keeps none');

console.log('ok: catch-up budgets, undo, and ranking');
