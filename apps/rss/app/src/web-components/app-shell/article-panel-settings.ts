export const ARTICLE_PANEL_WIDTH_KEY = 'rss-reader:article-width';
export const MIN_ARTICLE_PANEL_WIDTH = 360;
export const MAX_ARTICLE_PANEL_WIDTH = 1120;
export const DEFAULT_ARTICLE_PANEL_WIDTH = 880;

/** Arrow-key step for the article panel splitter, and the coarse step with Shift. */
export const ARTICLE_PANEL_KEY_STEP = 24;
export const ARTICLE_PANEL_KEY_STEP_LARGE = 96;

export function loadArticlePanelWidth(): number {
    try {
        const raw = localStorage.getItem(ARTICLE_PANEL_WIDTH_KEY);
        const width = raw ? Number(raw) : NaN;
        if (Number.isFinite(width)) return clampArticlePanelWidth(width);
        return DEFAULT_ARTICLE_PANEL_WIDTH;
    } catch {
        return DEFAULT_ARTICLE_PANEL_WIDTH;
    }
}

export function saveArticlePanelWidth(width: number): void {
    try {
        localStorage.setItem(ARTICLE_PANEL_WIDTH_KEY, String(width));
    } catch {
        // storage unavailable; panel width just won't persist
    }
}

/** The width a drag or key press asks for, held inside the bounds. */
export function clampArticlePanelWidth(raw: number): number {
    return Math.round(Math.min(MAX_ARTICLE_PANEL_WIDTH, Math.max(MIN_ARTICLE_PANEL_WIDTH, raw)));
}

/**
 * The next article panel width for a key press, per the WAI-ARIA window
 * splitter: arrows step, Home and End jump to the bounds. The panel docks
 * right, so ArrowLeft grows it and ArrowRight shrinks it. Null means the
 * caller should leave the key alone and not preventDefault.
 */
export function nextArticlePanelWidth(current: number, key: string, shiftKey: boolean): number | null {
    const step = shiftKey ? ARTICLE_PANEL_KEY_STEP_LARGE : ARTICLE_PANEL_KEY_STEP;
    if (key === 'ArrowLeft') return clampArticlePanelWidth(current + step);
    if (key === 'ArrowRight') return clampArticlePanelWidth(current - step);
    if (key === 'Home') return MAX_ARTICLE_PANEL_WIDTH;
    if (key === 'End') return MIN_ARTICLE_PANEL_WIDTH;
    return null;
}
