const LEGACY_LOCAL_PREFIX = 'rss-reader:';
const CURRENT_LOCAL_PREFIX = 'times-up:';

function copyStorageKey(storage: Storage, oldKey: string, newKey: string): void {
    if (storage.getItem(newKey) !== null) return;
    const value = storage.getItem(oldKey);
    if (value === null) return;
    storage.setItem(newKey, value);
}

/** Move legacy local settings and auth state before the renamed app reads them. */
export function migrateLegacyLocalStorage(): void {
    try {
        const localKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter(
            (key): key is string => key !== null,
        );
        for (const key of localKeys) {
            if (key.startsWith(LEGACY_LOCAL_PREFIX)) {
                copyStorageKey(localStorage, key, `${CURRENT_LOCAL_PREFIX}${key.slice(LEGACY_LOCAL_PREFIX.length)}`);
            } else if (key === 'rss.auth.tokens') {
                copyStorageKey(localStorage, key, 'times-up.auth.tokens');
            }
        }
        for (const key of localKeys) {
            if (key.startsWith(LEGACY_LOCAL_PREFIX) || key === 'rss.auth.tokens') localStorage.removeItem(key);
        }
        const sessionKeys = Array.from({ length: sessionStorage.length }, (_, index) =>
            sessionStorage.key(index),
        ).filter((key): key is string => key !== null);
        for (const key of sessionKeys) {
            if (key.startsWith('rss.auth.')) {
                copyStorageKey(sessionStorage, key, key.replace(/^rss\.auth\./, 'times-up.auth.'));
            }
        }
        for (const key of sessionKeys) {
            if (key.startsWith('rss.auth.')) sessionStorage.removeItem(key);
        }
    } catch {
        // Storage can be unavailable in private mode. The app still opens with
        // fresh local state rather than failing before sign-in.
    }
}

migrateLegacyLocalStorage();
