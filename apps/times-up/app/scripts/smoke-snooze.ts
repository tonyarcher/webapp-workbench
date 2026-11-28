// B5 smoke: snooze hides only active ids, stores no article payload, and wakes
// naturally when the timestamp passes.
import { assert } from './smoke-assert';
import { memoryStorage } from './smoke-storage';
import {
    activeSnoozedIds,
    loadSnoozed,
    parseSnoozeEntries,
    removeSnoozed,
    snoozeArticle,
    snoozeUntil,
} from '../src/services/snooze';
import type { Article } from '../src/types';

const article = { id: 'a1', title: 'Private title', link: 'https://example.com/a1' } as Article;
const store = memoryStorage();
const now = new Date(2026, 10, 27, 12, 0);

snoozeArticle(article, now.getTime() + 60_000, store);
assert(activeSnoozedIds(loadSnoozed(store), now.getTime()).has('a1'), 'an active snooze hides the row');
assert(
    !activeSnoozedIds(loadSnoozed(store), now.getTime() + 120_000).has('a1'),
    'an expired snooze lets the row return',
);
const stored = JSON.stringify(loadSnoozed(store));
assert(!stored.includes('Private title') && !stored.includes('example.com'), 'snooze stores no article payload');

snoozeArticle(article, now.getTime() + 120_000, store);
assert(loadSnoozed(store).length === 1, 'snoozing the same row again replaces its wake time');
removeSnoozed('a1', store);
assert(loadSnoozed(store).length === 0, 'removing a snooze clears it');
assert(parseSnoozeEntries('{').length === 0, 'malformed snooze JSON is ignored');
assert(parseSnoozeEntries(JSON.stringify([null, { id: 'a', until: 1 }])).length === 1, 'valid snooze rows survive');

const evening = snoozeUntil('tonight', now);
assert(new Date(evening).getHours() === 20, 'tonight wakes at 20:00');
const late = new Date(2026, 10, 27, 21, 0);
assert(new Date(snoozeUntil('tonight', late)).getDate() === 28, 'after 20:00 tonight means tomorrow evening');
assert(new Date(snoozeUntil('tomorrow', now)).getHours() === 9, 'tomorrow wakes at 09:00');
assert(new Date(snoozeUntil('weekend', now)).getDay() === 6, 'weekend wakes on Saturday');

const globals = globalThis as Record<string, unknown>;
const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const shared = memoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: shared, configurable: true });
snoozeArticle(article, now.getTime() + 60_000);
shared.setItem('times-up:snoozed', JSON.stringify([{ id: 'other-tab', until: now.getTime() + 60_000 }]));
assert(
    loadSnoozed().some((entry) => entry.id === 'other-tab'),
    "a readable store is re-read so other tabs' changes appear",
);
if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
else delete globals['localStorage'];

Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
snoozeArticle(article, now.getTime() + 60_000);
assert(activeSnoozedIds(loadSnoozed(), now.getTime()).has('a1'), 'a blocked store still hides for this session');
removeSnoozed('a1');
if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
else delete globals['localStorage'];

console.log('ok: snooze hides rows until their local wake time');
