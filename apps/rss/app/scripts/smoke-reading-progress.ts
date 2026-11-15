// Reading progress smoke: save, restore, and completion clearing (C4).
import { assert } from './smoke-assert';
import {
    clearReadingProgress,
    loadReadingProgress,
    READING_COMPLETE_FRACTION,
    saveReadingProgress,
} from '../src/services/reading-progress';

if (typeof localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as Record<string, unknown>)['localStorage'] = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => void store.clear(),
    };
}

localStorage.removeItem('rss-reader:reading-progress');

saveReadingProgress('a1', 0.42, 1000);
assert(loadReadingProgress('a1') === 0.42, 'reading progress saves and restores a mid-article fraction');

saveReadingProgress('a1', 0.01, 2000);
assert(loadReadingProgress('a1') === null, 'tiny progress is cleared instead of persisted');

saveReadingProgress('a2', 0.5, 3000);
saveReadingProgress('a2', READING_COMPLETE_FRACTION, 4000);
assert(loadReadingProgress('a2') === null, 'completion clears saved progress');

saveReadingProgress('a3', 0.6, 5000);
clearReadingProgress('a3');
assert(loadReadingProgress('a3') === null, 'clearReadingProgress removes saved progress');

saveReadingProgress('a4', -1, 6000);
assert(loadReadingProgress('a4') === null, 'negative progress is not persisted');
saveReadingProgress('a4', 1.5, 6000);
assert(loadReadingProgress('a4') === null, 'over-complete progress is treated as completion and cleared');

console.log('smoke-reading-progress: ok');
