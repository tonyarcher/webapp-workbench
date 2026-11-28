// S4 smoke: the unread total and badge formatting are pure, so they can be
// pinned without a browser or a badge API.
import { assert } from './smoke-assert';
import { memoryStorage } from './smoke-storage';
import {
    APP_BADGE_CAP,
    badgeEnabled,
    badgeLabel,
    badgeValue,
    saveBadgeEnabled,
    totalUnreadFromLibrary,
} from '../src/services/app-badge';

assert(totalUnreadFromLibrary(null) === 0, 'a missing library contributes zero');
assert(totalUnreadFromLibrary({}) === 0, 'a library without feeds contributes zero');
assert(totalUnreadFromLibrary({ feeds: [] }) === 0, 'an empty feed list contributes zero');

const data = { feeds: [{ unread: 3 }, { unread: 0 }, { unread: 7 }] };
assert(totalUnreadFromLibrary(data) === 10, 'the total is the sum of feed unread counts');
assert(totalUnreadFromLibrary({ feeds: [{ unread: 5 }, {}] }) === 5, 'a missing unread defaults to zero');

assert(badgeValue(0) === 0, 'zero maps to zero');
assert(badgeValue(10) === 10, 'small counts pass through');
assert(badgeValue(APP_BADGE_CAP) === APP_BADGE_CAP, 'the cap is inclusive');
assert(badgeValue(APP_BADGE_CAP + 1) === APP_BADGE_CAP, 'counts above the cap clamp to the cap');

assert(badgeLabel(0) === '', 'zero has no label');
assert(badgeLabel(5) === '5', 'small counts render as digits');
assert(badgeLabel(99) === '99', '99 renders without a plus');
assert(badgeLabel(100) === '99+', '100 renders as 99+');

const store = memoryStorage();
assert(badgeEnabled(store), 'the badge defaults on');
saveBadgeEnabled(false, store);
assert(!badgeEnabled(store), 'the badge preference persists off');
saveBadgeEnabled(true, store);
assert(badgeEnabled(store), 'the badge preference persists on');
assert(badgeEnabled(null), 'a blocked store keeps the default');

const globals = globalThis as Record<string, unknown>;
const priorStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
saveBadgeEnabled(false);
assert(!badgeEnabled(), 'a blocked store still honors the live off setting');
saveBadgeEnabled(true);
assert(badgeEnabled(), 'the live setting can be turned back on without storage');
if (priorStorage) Object.defineProperty(globalThis, 'localStorage', priorStorage);
else delete globals['localStorage'];
