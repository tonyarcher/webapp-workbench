import {createHashHistory} from '@tanstack/history';
import type {View} from './types';

export const history = createHashHistory();

export function parsePath(pathname: string): View {
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] === 'folder' && parts[1]) {
        return {kind: 'folder', id: decodeURIComponent(parts[1])};
    }
    if (parts[0] === 'feed' && parts[1]) {
        return {kind: 'feed', id: decodeURIComponent(parts[1])};
    }
    if (parts[0] === 'brief') {
        return {kind: 'brief'};
    }
    if (parts[0] === 'today') {
        return {kind: 'today'};
    }
    return {kind: 'all'};
}

export function viewToPath(view: View): string {
    switch (view.kind) {
        case 'all':
            return '/all';
        case 'brief':
            return '/brief';
        case 'today':
            return '/today';
        case 'folder':
            return `/folder/${encodeURIComponent(view.id)}`;
        case 'feed':
            return `/feed/${encodeURIComponent(view.id)}`;
    }
}

export function navigate(view: View) {
    history.push(viewToPath(view));
}
