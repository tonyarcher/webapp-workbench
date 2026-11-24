import { migrateLegacyLocalStorage } from '../src/services/storage-migration';
import { assert } from './smoke-assert';

function memoryStorage(): Storage {
    const data = new Map<string, string>();
    return {
        get length() {
            return data.size;
        },
        clear: () => data.clear(),
        getItem: (key: string) => data.get(key) ?? null,
        key: (index: number) => [...data.keys()][index] ?? null,
        removeItem: (key: string) => void data.delete(key),
        setItem: (key: string, value: string) => void data.set(key, String(value)),
    } as Storage;
}

const shims = globalThis as Record<string, unknown>;
const realLocal = shims['localStorage'];
const realSession = shims['sessionStorage'];
const local = memoryStorage();
const session = memoryStorage();
shims['localStorage'] = local;
shims['sessionStorage'] = session;
try {
    local.setItem('rss-reader:quota', 'keep');
    const setItem = local.setItem;
    local.setItem = (key: string, value: string) => {
        if (key === 'times-up:quota') throw new Error('quota');
        setItem.call(local, key, value);
    };
    migrateLegacyLocalStorage();
    assert(local.getItem('rss-reader:quota') === 'keep', 'a failed copy keeps the legacy value');
    local.setItem = setItem;
    local.clear();
    session.clear();

    local.setItem('rss-reader:theme', 'dark');
    local.setItem('rss-reader:word-map', '{"rust":8}');
    local.setItem('rss.auth.tokens', '{"access":"old"}');
    local.setItem('times-up:theme', 'light');
    session.setItem('rss.auth.verifier', 'legacy-verifier');
    migrateLegacyLocalStorage();
    assert(local.getItem('times-up:theme') === 'light', 'migration keeps the newer local value');
    assert(local.getItem('times-up:word-map') === '{"rust":8}', 'migration copies legacy local settings');
    assert(local.getItem('times-up.auth.tokens') === '{"access":"old"}', 'migration preserves the signed-in session');
    assert(session.getItem('times-up.auth.verifier') === 'legacy-verifier', 'migration preserves an in-flight login');
    assert(
        local.getItem('rss-reader:theme') === null && local.getItem('rss.auth.tokens') === null,
        'migration removes legacy local keys',
    );
    assert(session.getItem('rss.auth.verifier') === null, 'migration removes legacy login keys');
    migrateLegacyLocalStorage();
    assert(local.getItem('times-up:word-map') === '{"rust":8}', 'migration is safe to run more than once');
} finally {
    shims['localStorage'] = realLocal;
    shims['sessionStorage'] = realSession;
}

console.log('smoke-storage-migration: ok');
