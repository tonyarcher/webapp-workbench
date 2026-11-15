import { assert } from './smoke-assert.js';
import type { Article } from '../src/types.js';
import {
    clearFocusSession,
    finishFocusSession,
    loadFocusSession,
    loadFocusStreak,
    localDateKey,
    markFocusDone,
    rankFocusQueue,
    recordKeptSession,
    remainingFocusIds,
    startFocusSession,
} from '../src/services/focus-session.js';

function makeStore(): Storage {
    const data = new Map<string, string>();
    return {
        get length() {
            return data.size;
        },
        clear() {
            data.clear();
        },
        getItem(key: string) {
            return data.has(key) ? data.get(key)! : null;
        },
        key(index: number) {
            return [...data.keys()][index] ?? null;
        },
        removeItem(key: string) {
            data.delete(key);
        },
        setItem(key: string, value: string) {
            data.set(key, value);
        },
    } as Storage;
}

const g = globalThis as Record<string, unknown>;
g['localStorage'] = makeStore();
const prevWindow = g['window'];
g['window'] = {
    ...(typeof prevWindow === 'object' && prevWindow ? (prevWindow as object) : {}),
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
};

function art(id: string, read: 0 | 1, hot = 0, published = 0): Article {
    return {
        id,
        feedId: 'f',
        guid: id,
        title: `Title ${id}`,
        published,
        fetchedAt: 0,
        read,
        starred: false,
        popularity: 0,
        hot,
    };
}

clearFocusSession();
assert(loadFocusSession() === null, 'no focus session initially');
assert(loadFocusStreak().kept === 0, 'streak starts at zero');

const articles = [art('a', 0, 5, 3), art('b', 1, 9, 9), art('c', 0, 1, 1), art('d', 0, 7, 2)];
const queue = rankFocusQueue(articles, 2);
assert(queue.length === 2, 'focus queue respects limit');
assert(
    queue.every((a) => a.read === 0),
    'focus queue excludes read articles',
);

const started = startFocusSession(articles, 10 * 60_000, 1_000_000, 3);
assert(started.status === 'running', 'started focus session is running');
assert(started.queueIds.length === 3, 'started focus session queues unread articles');
assert(started.endsAt === 1_000_000 + 10 * 60_000, 'focus session endsAt set from duration');

const doneOne = markFocusDone(started, started.queueIds[0]!);
assert(doneOne.doneIds.length === 1, 'markFocusDone records article once');
const doneAgain = markFocusDone(doneOne, started.queueIds[0]!);
assert(doneAgain.doneIds.length === 1, 'markFocusDone is idempotent');
assert(remainingFocusIds(doneOne).length === 2, 'remainingFocusIds excludes done');

const finished = finishFocusSession(doneOne);
assert(finished.status === 'done', 'finishFocusSession marks done');
assert(loadFocusSession()?.status === 'done', 'focus session persists');

clearFocusSession();
assert(loadFocusSession() === null, 'clearFocusSession removes session');

const day = localDateKey(new Date(2026, 10, 15, 9, 0, 0).getTime());
assert(day === '2026-11-15', 'localDateKey formats local date');

(globalThis as Record<string, unknown>)['localStorage'] = makeStore();
const s1 = recordKeptSession(new Date(2026, 10, 15, 9, 0, 0).getTime());
assert(s1.kept === 1, 'recordKeptSession increments kept');
const s2 = recordKeptSession(new Date(2026, 10, 15, 18, 0, 0).getTime());
assert(s2.kept === 1, 'recordKeptSession counts once per day');
const s3 = recordKeptSession(new Date(2026, 10, 16, 9, 0, 0).getTime());
assert(s3.kept === 2, 'recordKeptSession increments on new day');

console.log('smoke-focus-session: ok');
