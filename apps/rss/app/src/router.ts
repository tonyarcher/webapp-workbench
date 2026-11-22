import { createHashHistory } from '@tanstack/history';
import type { SettingsSection, View } from './types';

export const history = createHashHistory();

const SETTINGS_SECTIONS: readonly SettingsSection[] = [
    'general',
    'organize',
    'mute-filters',
    'privacy',
    'ai-connections',
    'stats',
    'glossary',
];

/**
 * Old top-level routes and the tab each one became. The paths stay parseable so
 * a bookmark or an installed PWA's saved URL still opens the right panel.
 */
const LEGACY_SETTINGS_PATHS: Record<string, SettingsSection> = {
    organize: 'organize',
    'mute-filters': 'mute-filters',
    privacy: 'privacy',
    stats: 'stats',
    glossary: 'glossary',
};

function isSettingsSection(value: string | undefined): value is SettingsSection {
    return value !== undefined && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export function parsePath(pathname: string, search = ''): View {
    const [pathPart, queryPart] = pathname.split('?');
    const parts = (pathPart ?? '').split('/').filter(Boolean);
    const params = new URLSearchParams(search || queryPart || '');
    if (parts[0] === 'settings') {
        return { kind: 'settings', section: isSettingsSection(parts[1]) ? parts[1] : 'general' };
    }
    const legacy = parts[0] ? LEGACY_SETTINGS_PATHS[parts[0]] : undefined;
    if (legacy) return { kind: 'settings', section: legacy };
    if (parts[0] === 'folder' && parts[1]) {
        return { kind: 'folder', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'interesting' && parts[1]) {
        return { kind: 'interesting', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'feed' && parts[1]) {
        return { kind: 'feed', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'brief') {
        return { kind: 'brief' };
    }
    if (parts[0] === 'today') {
        return { kind: 'today' };
    }
    if (parts[0] === 'frontpage') {
        return { kind: 'frontpage' };
    }
    if (parts[0] === 'focus') {
        return { kind: 'focus' };
    }
    if (parts[0] === 'saved') {
        return { kind: 'saved' };
    }
    if (parts[0] === 'backgrounder') {
        return { kind: 'backgrounder' };
    }
    if (parts[0] === 'listen') {
        return { kind: 'listen' };
    }
    if (parts[0] === 'coverage') {
        return { kind: 'coverage' };
    }
    if (parts[0] === 'boards') {
        return { kind: 'boards' };
    }
    if (parts[0] === 'board' && parts[1]) {
        return { kind: 'board', id: decodeURIComponent(parts[1]) };
    }
    if (parts[0] === 'search') {
        const scope = params.get('scope');
        const id = params.get('id') ?? undefined;
        const q = params.get('q') ?? undefined;
        const savedId = params.get('saved') ?? undefined;
        const scopeKind = scope === 'folder' || scope === 'feed' || scope === 'all' ? scope : undefined;
        return {
            kind: 'search',
            ...(scopeKind ? { scope: scopeKind } : {}),
            ...(id ? { id } : {}),
            ...(q ? { q } : {}),
            ...(savedId ? { savedId } : {}),
        };
    }
    return { kind: 'all' };
}

export function viewToPath(view: View): string {
    switch (view.kind) {
        case 'all':
            return '/all';
        case 'brief':
            return '/brief';
        case 'today':
            return '/today';
        case 'frontpage':
            return '/frontpage';
        case 'focus':
            return '/focus';
        case 'settings':
            return view.section === 'general' ? '/settings' : `/settings/${view.section}`;
        case 'saved':
            return '/saved';
        case 'backgrounder':
            return '/backgrounder';
        case 'listen':
            return '/listen';
        case 'coverage':
            return '/coverage';
        case 'boards':
            return '/boards';
        case 'board':
            return `/board/${encodeURIComponent(view.id)}`;
        case 'folder':
            return `/folder/${encodeURIComponent(view.id)}`;
        case 'interesting':
            return `/interesting/${encodeURIComponent(view.id)}`;
        case 'feed':
            return `/feed/${encodeURIComponent(view.id)}`;
        case 'search': {
            const params = new URLSearchParams();
            if (view.scope) params.set('scope', view.scope);
            if (view.id) params.set('id', view.id);
            if (view.q) params.set('q', view.q);
            if (view.savedId) params.set('saved', view.savedId);
            const qs = params.toString();
            return qs ? `/search?${qs}` : '/search';
        }
    }
}

export function navigate(view: View, replace = false) {
    const path = viewToPath(view);
    if (replace) history.replace(path);
    else history.push(path);
}
