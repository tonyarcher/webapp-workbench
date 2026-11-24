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

const FONTS: Record<ReaderFont, string> = {
    sans: 'var(--font-family)',
    serif: 'Georgia, "Times New Roman", serif',
    dyslexia: '"OpenDyslexic", "Comic Sans MS", sans-serif',
};

const SIZES: Record<ReaderSize, string> = { small: '14px', medium: '16px', large: '19px' };
const LINES: Record<ReaderLine, string> = { compact: '1.4', normal: '1.7', relaxed: '2.0' };
const WIDTHS: Record<ReaderWidth, string> = { narrow: '600px', medium: '760px', wide: '920px' };

export function loadReaderMode(): ReaderMode {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return { font: 'sans', size: 'medium', line: 'normal', width: 'medium' };
        const p = JSON.parse(raw) as Partial<ReaderMode>;
        return {
            font: (p.font as ReaderFont) ?? 'sans',
            size: (p.size as ReaderSize) ?? 'medium',
            line: (p.line as ReaderLine) ?? 'normal',
            width: (p.width as ReaderWidth) ?? 'medium',
        };
    } catch {
        return { font: 'sans', size: 'medium', line: 'normal', width: 'medium' };
    }
}

export function saveReaderMode(mode: ReaderMode): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(mode));
    } catch {
        // ignore
    }
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
