import { noteOriginal, noteShare } from '../../mutations';
import { canNativeShare, mailtoShareUrl, shareUrl, type ShareTarget } from '../../services/share';
import { loadMastodonHost, loadShareTargets } from '../../services/share-settings';
import { anchorFromEvent, type MenuAnchor } from '../menu-popover';
import type { Article } from '../../types';
import {
    actionIcon,
    copyLinkForInstagram,
    copyMarkdownCitation,
    copyQuoteCard,
    copyTitleLink,
    shareIcon,
} from './article-view-helpers';
import { el, appendAll, iconButton } from './article-view-dom';

/**
 * State and handlers the toolbar builders read. The component passes itself
 * (`this as never`, matching the article-list render modules).
 */
export interface ArticleViewToolbarHost {
    deranked: boolean;
    savedForLater: boolean;
    overflowOpen: boolean;
    speedReadOpen: boolean;
    emitClose: () => void;
    onStar(): Promise<void>;
    onDerank(): void;
    onToggleRead(): Promise<void>;
    onToggleSaved(): Promise<void>;
    openBoardPicker(): Promise<void>;
    enqueueListen(): void;
    nativeShare(a: Article, link: string): Promise<void>;
    onManageFolders(anchor: MenuAnchor): void;
    paint(): void;
}

export function buildToolbar(host: ArticleViewToolbarHost, a: Article, link: string | undefined): Node[] {
    const toolbar = el('div', 'toolbar');
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Article actions');

    const backGroup = el('div', 'toolbar-group');
    backGroup.appendChild(iconButton(actionIcon('back'), { label: 'Back', title: 'Back', onClick: host.emitClose }));
    toolbar.appendChild(backGroup);

    appendAll(toolbar, buildStateButtons(host, a));

    if (link) {
        const divider = el('span', 'toolbar-divider');
        divider.setAttribute('aria-hidden', 'true');
        toolbar.appendChild(divider);
        appendAll(toolbar, buildShareButtons(host, a, link));
    }

    toolbar.appendChild(el('div', 'spacer'));
    if (link) toolbar.appendChild(buildOpenOriginal(a, link));
    return [toolbar];
}

export function buildStateButtons(host: ArticleViewToolbarHost, a: Article): Node[] {
    const group = el('div', 'toolbar-group');
    group.setAttribute('aria-label', 'Article state');

    group.appendChild(
        iconButton(actionIcon(a.starred ? 'starred' : 'star'), {
            ...(a.starred ? { className: 'active' } : {}),
            label: a.starred ? 'Unstar' : 'Star',
            title: a.starred ? 'Unstar' : 'Star',
            pressed: a.starred,
            disabled: host.deranked,
            onClick: () => void host.onStar(),
        }),
    );
    group.appendChild(
        iconButton(actionIcon(host.deranked ? 'deranked' : 'derank'), {
            ...(host.deranked ? { className: 'active' } : {}),
            label: 'Not interesting',
            title: host.deranked ? 'Marked not interesting' : 'Not interesting',
            pressed: host.deranked,
            onClick: () => host.onDerank(),
        }),
    );
    group.appendChild(
        iconButton(actionIcon(a.read ? 'read' : 'unread'), {
            label: a.read ? 'Keep unread' : 'Mark read',
            title: a.read ? 'Keep unread' : 'Mark read',
            onClick: () => void host.onToggleRead(),
        }),
    );
    group.appendChild(
        iconButton(actionIcon(host.savedForLater ? 'saved' : 'save'), {
            ...(host.savedForLater ? { className: 'active' } : {}),
            label: host.savedForLater ? 'Saved for later' : 'Save for later',
            title: host.savedForLater ? 'Saved for later' : 'Save for later',
            pressed: host.savedForLater,
            onClick: () => void host.onToggleSaved(),
        }),
    );
    const folders = el('button', 'btn toolbar-folders', 'Folders');
    folders.title = 'Manage feed folders';
    folders.setAttribute('aria-label', 'Manage feed folders');
    folders.addEventListener('click', (e) => host.onManageFolders(anchorFromEvent(e as MouseEvent)));
    group.appendChild(folders);
    group.appendChild(
        iconButton(actionIcon('more'), {
            label: 'More actions',
            title: 'More actions',
            onClick: () => {
                host.overflowOpen = !host.overflowOpen;
                host.paint();
            },
        }),
    );

    if (host.overflowOpen) {
        const backdrop = el('div', 'overflow-backdrop');
        backdrop.addEventListener('click', () => {
            host.overflowOpen = false;
            host.paint();
        });
        group.appendChild(backdrop);

        const menu = el('div', 'overflow-menu');
        const speed = el('button', 'btn', '⚡ Speed read');
        speed.addEventListener('click', () => {
            host.speedReadOpen = true;
            host.overflowOpen = false;
            host.paint();
        });
        menu.appendChild(speed);
        const board = el('button', 'btn', '📋 Add to board');
        board.addEventListener('click', () => {
            void host.openBoardPicker();
            host.overflowOpen = false;
            host.paint();
        });
        menu.appendChild(board);
        const listen = el('button', 'btn', '🎧 Listen');
        listen.addEventListener('click', () => {
            host.enqueueListen();
            host.overflowOpen = false;
            host.paint();
        });
        menu.appendChild(listen);
        group.appendChild(menu);
    }
    return [group];
}

export function buildOpenOriginal(a: Article, link: string): HTMLElement {
    const anchor = el('a', 'btn icon-btn primary');
    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.setAttribute('aria-label', 'Open original');
    anchor.title = 'Open original';
    anchor.appendChild(actionIcon('external'));
    anchor.addEventListener('click', () => noteOriginal(a.id, a.title));
    return anchor;
}

/** Compact share/copy actions: icon-only buttons with accessible labels. */
export function buildShareButtons(host: ArticleViewToolbarHost, a: Article, link: string): Node[] {
    const group = el('div', 'toolbar-group toolbar-share');
    group.setAttribute('aria-label', 'Share and copy');
    const open = (target: 'facebook' | 'x' | 'mastodon') => (e: Event) => {
        e.stopPropagation();
        const href = shareUrl(target, link, a.title, loadMastodonHost());
        if (href) {
            noteShare(a.id, a.title);
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    };
    const labels: Record<ShareTarget, string> = {
        facebook: 'Share on Facebook',
        x: 'Share on X',
        mastodon: 'Share on Mastodon',
        instagram: 'Copy link for Instagram',
    };
    const socialButton = (target: ShareTarget): HTMLButtonElement => {
        const handler: (e: Event) => void =
            target === 'instagram' ? () => void copyLinkForInstagram(link, a) : open(target);
        return iconButton(shareIcon(target), { label: labels[target], title: labels[target], onClick: handler });
    };
    for (const target of loadShareTargets()) group.appendChild(socialButton(target));
    if (canNativeShare()) {
        group.appendChild(
            iconButton(actionIcon('share'), {
                label: 'Share',
                title: 'Share',
                onClick: () => void host.nativeShare(a, link),
            }),
        );
    }
    group.appendChild(
        iconButton(actionIcon('copy'), {
            label: 'Copy link',
            title: 'Copy link',
            onClick: () => void copyTitleLink(a, link),
        }),
    );
    group.appendChild(
        iconButton(actionIcon('markdown'), {
            label: 'Copy markdown citation',
            title: 'Copy markdown citation',
            onClick: () => void copyMarkdownCitation(a, link),
        }),
    );
    group.appendChild(
        iconButton(actionIcon('quote'), {
            label: 'Copy quote card',
            title: 'Copy quote card',
            onClick: () => void copyQuoteCard(a, link),
        }),
    );
    const mail = el('a', 'btn icon-btn');
    mail.href = mailtoShareUrl(link, a.title);
    mail.setAttribute('aria-label', 'Email');
    mail.title = 'Email';
    mail.appendChild(actionIcon('mail'));
    mail.addEventListener('click', () => noteShare(a.id, a.title));
    group.appendChild(mail);
    return [group];
}
