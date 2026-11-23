import { FeedFoldersMenu } from '../feed-folders-menu/feed-folders-menu';
import type { MenuAnchor } from '../menu-popover';

/**
 * Own one feed-folders menu for the list. Cards emit `open-feed-folders`
 * with the article's feed id and the trigger anchor; the menu then writes
 * through the shared membership mutation.
 */
export function mountFeedFoldersMenu(host: HTMLElement, shadow: ShadowRoot): FeedFoldersMenu {
    const menu = new FeedFoldersMenu();
    menu.addEventListener('close', () => {
        menu.open = false;
    });
    host.addEventListener('open-feed-folders', ((e: CustomEvent<{ feedId: string; anchor: MenuAnchor }>) => {
        menu.feedId = e.detail.feedId;
        menu.anchor = e.detail.anchor;
        menu.open = true;
    }) as EventListener);
    shadow.appendChild(menu);
    return menu;
}
