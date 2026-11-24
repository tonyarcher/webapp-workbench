import { setInterestingHideRead } from '../../services/interesting-counts';
import { detachScrollBindings, type LayoutHost } from './article-list-layout';
import { clearSlideshowAuto } from './article-list-slideshow';

/**
 * Listener wiring for connectedCallback/disconnectedCallback. The handler
 * fields stay public on the element (stable arrow identities) so this module
 * adds and removes the exact same references.
 */
export interface ListenerHost extends LayoutHost {
    onKeyDown: (e: KeyboardEvent) => void;
    onFeedsRefreshed: () => void;
    onArticleRead: (e: Event) => void;
    onArticleStarred: (e: Event) => void;
    onSavedArticlesChanged: () => void;
    onMuteRulesChanged: () => void;
    onViewSettingsChanged: () => void;
    onStorage: (e: StorageEvent) => void;
    onHighlightsEnabledChanged: () => void;
    onToggleDerank: (e: Event) => void;
    addEventListener(type: 'toggle-derank', listener: (e: Event) => void): void;
    removeEventListener(type: 'toggle-derank', listener: (e: Event) => void): void;
}

/** Window events every list instance follows, paired with the handler field. */
const WINDOW_LISTENERS = [
    ['keydown', 'onKeyDown'],
    ['feeds-refreshed', 'onFeedsRefreshed'],
    ['article-read', 'onArticleRead'],
    ['article-starred', 'onArticleStarred'],
    ['saved-articles-changed', 'onSavedArticlesChanged'],
    ['mute-rules-changed', 'onMuteRulesChanged'],
    ['view-settings-changed', 'onViewSettingsChanged'],
    ['storage', 'onStorage'],
    ['highlights-enabled-changed', 'onHighlightsEnabledChanged'],
] as const;

export function attachHostListeners(host: ListenerHost): void {
    for (const [type, key] of WINDOW_LISTENERS) {
        window.addEventListener(type, host[key] as EventListener);
    }
    host.addEventListener('toggle-derank', host.onToggleDerank);
    host.dwell.start();
}

export function detachHostListeners(host: ListenerHost): void {
    for (const [type, key] of WINDOW_LISTENERS) {
        window.removeEventListener(type, host[key] as EventListener);
    }
    host.removeEventListener('toggle-derank', host.onToggleDerank);
}

export interface TeardownHost extends ListenerHost {
    virtualizerCleanup?: () => void;
    interestingHideReadFolderId: string | null;
}

/** disconnectedCallback after super(): stop every timer, watcher, and mirror this element owned. */
export function teardownHost(host: TeardownHost): void {
    clearSlideshowAuto(host as never);
    detachHostListeners(host);
    detachScrollBindings(host);
    host.dwell.stop();
    host.virtualizerCleanup?.();
    if (host.interestingHideReadFolderId) {
        setInterestingHideRead(host.interestingHideReadFolderId, false);
        host.interestingHideReadFolderId = null;
    }
}
