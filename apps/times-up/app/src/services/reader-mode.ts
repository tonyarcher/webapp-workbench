import { safeLocalStorage } from './local-storage';

export type ReaderFont = 'sans' | 'serif' | 'dyslexia';
export type ReaderSize = 'small' | 'medium' | 'large';
export type ReaderLine = 'compact' | 'normal' | 'relaxed';
export type ReaderWidth = 'narrow' | 'medium' | 'wide';

export interface ReaderMode {
    font: ReaderFont;
    size: ReaderSize;
    line: ReaderLine;
    width: ReaderWidth;
}

const KEY = 'times-up:reader-mode';
const FEED_PREFIX = 'times-up:reader-mode:feed:';
const DEFAULT: ReaderMode = { font: 'sans', size: 'medium', line: 'normal', width: 'medium' };

const FONTS: Record<ReaderFont, string> = {
    sans: 'var(--font-family)',
    serif: 'Georgia, "Times New Roman", serif',
    dyslexia: '"OpenDyslexic", "Comic Sans MS", sans-serif',
};

const SIZES: Record<ReaderSize, string> = { small: '14px', medium: '16px', large: '19px' };
const LINES: Record<ReaderLine, string> = { compact: '1.4', normal: '1.7', relaxed: '2.0' };
const WIDTHS: Record<ReaderWidth, string> = { narrow: '600px', medium: '760px', wide: '920px' };

function parseMode(raw: string | null): ReaderMode {
    if (!raw) return { ...DEFAULT };
    try {
        const p = JSON.parse(raw) as Partial<ReaderMode>;
        return {
            font: p.font === 'serif' || p.font === 'dyslexia' ? p.font : 'sans',
            size: p.size === 'small' || p.size === 'large' ? p.size : 'medium',
            line: p.line === 'compact' || p.line === 'relaxed' ? p.line : 'normal',
            width: p.width === 'narrow' || p.width === 'wide' ? p.width : 'medium',
        };
    } catch {
        return { ...DEFAULT };
    }
}

function read(key: string, storage?: Storage | null): ReaderMode {
    const store = storage === undefined ? safeLocalStorage() : storage;
    try {
        return parseMode(store?.getItem(key) ?? null);
    } catch {
        return { ...DEFAULT };
    }
}

function write(key: string, mode: ReaderMode, storage?: Storage | null): void {
    const store = storage === undefined ? safeLocalStorage() : storage;
    try {
        store?.setItem(key, JSON.stringify(mode));
    } catch {
        // The live page still uses the selected mode.
    }
}

export function loadReaderMode(storage?: Storage | null): ReaderMode {
    return read(KEY, storage);
}

export function saveReaderMode(mode: ReaderMode, storage?: Storage | null): void {
    write(KEY, mode, storage);
}

export function loadFeedReaderMode(feedId: string, storage?: Storage | null): ReaderMode | null {
    const store = storage === undefined ? safeLocalStorage() : storage;
    const key = `${FEED_PREFIX}${feedId}`;
    try {
        const raw = store?.getItem(key);
        return raw ? parseMode(raw) : null;
    } catch {
        return null;
    }
}

export function saveFeedReaderMode(feedId: string, mode: ReaderMode, storage?: Storage | null): void {
    write(`${FEED_PREFIX}${feedId}`, mode, storage);
}

export function clearFeedReaderMode(feedId: string, storage?: Storage | null): void {
    const store = storage === undefined ? safeLocalStorage() : storage;
    try {
        store?.removeItem(`${FEED_PREFIX}${feedId}`);
    } catch {
        // Nothing to clear when the store is blocked.
    }
}

export function readerModeForFeed(feedId: string, storage?: Storage | null): ReaderMode {
    return loadFeedReaderMode(feedId, storage) ?? loadReaderMode(storage);
}

export function readerModeVars(mode: ReaderMode): Record<string, string> {
    return {
        '--reading-font-family': FONTS[mode.font],
        '--reading-font-size': SIZES[mode.size],
        '--reading-line-height': LINES[mode.line],
        '--reading-width': WIDTHS[mode.width],
    };
}

export function applyReaderMode(mode: ReaderMode): void {
    const vars = readerModeVars(mode);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    window.dispatchEvent(new CustomEvent('reader-mode-changed'));
}
