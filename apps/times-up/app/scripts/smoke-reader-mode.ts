// C3 smoke: global reader mode plus per-feed defaults and fallback.
import { assert } from './smoke-assert';
import { memoryStorage } from './smoke-storage';
import {
    clearFeedReaderMode,
    loadFeedReaderMode,
    loadReaderMode,
    readerModeForFeed,
    readerModeVars,
    saveFeedReaderMode,
    saveReaderMode,
    type ReaderMode,
} from '../src/services/reader-mode';

const store = memoryStorage();
const global: ReaderMode = { font: 'serif', size: 'large', line: 'relaxed', width: 'narrow' };
const feed: ReaderMode = { font: 'dyslexia', size: 'small', line: 'compact', width: 'wide' };

assert(loadReaderMode(store).font === 'sans', 'reader mode defaults to sans');
saveReaderMode(global, store);
assert(loadReaderMode(store).font === 'serif', 'global reader mode persists');
assert(readerModeForFeed('feed-a', store).font === 'serif', 'a feed without an override uses the global mode');

saveFeedReaderMode('feed-a', feed, store);
assert(loadFeedReaderMode('feed-a', store)?.font === 'dyslexia', 'a feed override persists');
assert(readerModeForFeed('feed-a', store).size === 'small', 'the feed override wins over global');
assert(readerModeForFeed('feed-b', store).font === 'serif', 'another feed keeps the global mode');

clearFeedReaderMode('feed-a', store);
assert(loadFeedReaderMode('feed-a', store) === null, 'clearing removes the feed override');
assert(readerModeForFeed('feed-a', store).font === 'serif', 'clearing restores global fallback');

store.setItem('times-up:reader-mode', '{');
assert(loadReaderMode(store).font === 'sans', 'malformed global JSON falls back');
store.setItem('times-up:reader-mode:feed:bad', JSON.stringify({ font: 'comic', size: 'huge' }));
assert(loadFeedReaderMode('bad', store)?.font === 'sans', 'invalid feed values normalize to defaults');
assert(readerModeVars(global)['--reading-width'] === '600px', 'reader mode still maps to CSS variables');

console.log('ok: reader mode defaults per feed');
