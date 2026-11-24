export type Theme = 'light' | 'dark' | 'oled';

const STORAGE_KEY = 'times-up:theme';

export function getTheme(): Theme {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'dark' || saved === 'oled') return saved;
    return 'light';
}

export function applyTheme(theme: Theme) {
    document.documentElement.dataset['theme'] = theme;
    localStorage.setItem(STORAGE_KEY, theme);
}

export function initTheme() {
    applyTheme(getTheme());
}
