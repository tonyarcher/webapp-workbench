import {createHashHistory} from '@tanstack/history'
import type {RouterHistory} from '@tanstack/history'
import type {View} from './types'

let historyInstance: RouterHistory | null = null

/** Lazy so that importing this module (e.g. in Node smoke tests) never touches the DOM. */
export function getHistory(): RouterHistory {
    if (!historyInstance) historyInstance = createHashHistory()
    return historyInstance
}

/** Parses `#/community/123` style hash paths into the app's View union. */
export function parseView(pathname: string): View {
    const parts = pathname.split('/').filter(Boolean)
    if (parts[0] === 'communities') return {kind: 'communities'}
    if (parts[0] === 'community') {
        const id = Number(parts[1])
        if (Number.isInteger(id) && id > 0) return {kind: 'community', communityId: id}
        return {kind: 'communities'}
    }
    if (parts[0] === 'settings') return {kind: 'settings'}
    return {kind: 'feed'}
}

export function viewToPath(view: View): string {
    switch (view.kind) {
        case 'feed':
            return '/'
        case 'communities':
            return '/communities'
        case 'community':
            return `/community/${view.communityId}`
        case 'settings':
            return '/settings'
    }
}

export function navigate(view: View): void {
    getHistory().push(viewToPath(view))
}
