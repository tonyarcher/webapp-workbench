import { createHashHistory } from '@tanstack/history';
import type { View } from './types';

export const history = createHashHistory();

export function parsePath(pathname: string, search = ''): View {
    const [pathPart, queryPart] = pathname.split('?');
    const parts = (pathPart ?? '').split('/').filter(Boolean);
    const params = new URLSearchParams(search || queryPart || '');
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
    if (parts[0] === 'organize') {
        return { kind: 'organize' };
    }
    if (parts[0] === 'mute-filters') {
        return { kind: 'mute-filters' };
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
        case 'organize':
            return '/organize';
        case 'mute-filters':
            return '/mute-filters';
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
