import { FeedFoldersMenu } from '../feed-folders-menu/feed-folders-menu';
import type { MenuAnchor } from '../menu-popover';

/**
 * Own one feed-folders menu for the list. Cards emit `open-feed-folders`
 * with the article's feed id and the trigger anchor; the menu then writes
 * through the shared membership mutation.
 */
export function mountFeedFoldersMenu(host: HTMLElement, shadow: ShadowRoot): FeedFoldersMenu {
    const menu = new FeedFoldersMenu();
    let activeArticleId: string | null = null;
    let pointerDownArticleId: string | null = null;
    let dismissedArticleId: string | null = null;
    host.addEventListener('card-menu-pointerdown', ((e: CustomEvent<{ articleId: string }>) => {
        pointerDownArticleId = e.detail.articleId;
    }) as EventListener);
    host.addEventListener('card-menu-pointercancel', (() => {
        pointerDownArticleId = null;
        dismissedArticleId = null;
    }) as EventListener);
    menu.addEventListener('close', () => {
        // A close between this card's pointerdown and click is native light
        // dismiss. Remember it so the same click cannot reopen the menu.
        if (pointerDownArticleId !== null) dismissedArticleId = activeArticleId;
        pointerDownArticleId = null;
        menu.open = false;
    });
    host.addEventListener('open-feed-folders', ((
        e: CustomEvent<{ feedId: string; anchor: MenuAnchor; articleId: string }>,
    ) => {
        pointerDownArticleId = null;
        const sameCard = e.detail.articleId === activeArticleId;
        if (e.detail.articleId === dismissedArticleId) {
            dismissedArticleId = null;
            return;
        }
        dismissedArticleId = null;
        if (menu.open && sameCard) {
            activeArticleId = null;
            menu.open = false;
            return;
        }
        activeArticleId = e.detail.articleId;
        menu.feedId = e.detail.feedId;
        menu.anchor = e.detail.anchor;
        menu.open = true;
    }) as EventListener);
    shadow.appendChild(menu);
    return menu;
}
