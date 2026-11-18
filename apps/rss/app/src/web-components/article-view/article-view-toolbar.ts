import { html } from 'lit';
import { canNativeShare, mailtoShareUrl, shareUrl, type ShareTarget } from '../../services/share';
import { loadMastodonHost, loadShareTargets } from '../../services/share-settings';
import { noteOriginal, noteShare } from '../../mutations';
import type { Article } from '../../types';
import {
    actionIcon,
    copyLinkForInstagram,
    copyMarkdownCitation,
    copyQuoteCard,
    copyTitleLink,
    shareIcon,
} from './article-view-helpers';

/**
 * State and handlers the toolbar templates read. The component passes itself,
 * so the markup is the same markup the class rendered before the split.
 */
export interface ArticleViewToolbarHost {
    deranked: boolean;
    savedForLater: boolean;
    overflowOpen: boolean;
    speedReadOpen: boolean;
    emitClose(): void;
    onStar(): Promise<void>;
    onDerank(): void;
    onToggleRead(): Promise<void>;
    onToggleSaved(): Promise<void>;
    openBoardPicker(): Promise<void>;
    enqueueListen(): void;
}

export function renderToolbar(host: ArticleViewToolbarHost, a: Article, link: string | undefined) {
    return html`
      <div class="toolbar" role="toolbar" aria-label="Article actions">
        <div class="toolbar-group">
          <button class="btn icon-btn" @click=${host.emitClose} aria-label="Back" title="Back">${actionIcon('back')}</button>
        </div>
        ${renderStateButtons(host, a)}
        ${link ? html`<span class="toolbar-divider" aria-hidden="true"></span>${renderShareButtons(a, link)}` : ''}
        <div class="spacer"></div>
        ${link ? renderOpenOriginal(a, link) : ''}
      </div>`;
}

export function renderStateButtons(host: ArticleViewToolbarHost, a: Article) {
    return html`<div class="toolbar-group" aria-label="Article state">
      <button class="btn icon-btn ${a.starred ? 'active' : ''}" @click=${host.onStar} aria-label=${a.starred ? 'Unstar' : 'Star'} aria-pressed=${a.starred} title=${a.starred ? 'Unstar' : 'Star'} ?disabled=${host.deranked}>${actionIcon(a.starred ? 'starred' : 'star')}</button>
      <button class="btn icon-btn ${host.deranked ? 'active' : ''}" @click=${host.onDerank} aria-label="Not interesting" aria-pressed=${host.deranked} title=${host.deranked ? 'Marked not interesting' : 'Not interesting'}>${actionIcon(host.deranked ? 'deranked' : 'derank')}</button>
      <button class="btn icon-btn" @click=${host.onToggleRead} aria-label=${a.read ? 'Keep unread' : 'Mark read'} title=${a.read ? 'Keep unread' : 'Mark read'}>${actionIcon(a.read ? 'read' : 'unread')}</button>
      <button class="btn icon-btn ${host.savedForLater ? 'active' : ''}" @click=${host.onToggleSaved} aria-label=${host.savedForLater ? 'Saved for later' : 'Save for later'} aria-pressed=${host.savedForLater} title=${host.savedForLater ? 'Saved for later' : 'Save for later'}>${actionIcon(host.savedForLater ? 'saved' : 'save')}</button>
      <button class="btn icon-btn" @click=${() => (host.overflowOpen = !host.overflowOpen)} aria-label="More actions" title="More actions">${actionIcon('more')}</button>
      ${renderOverflowMenu(host)}
    </div>`;
}

function renderOverflowMenu(host: ArticleViewToolbarHost) {
    if (!host.overflowOpen) return '';
    return html`<div class="overflow-backdrop" @click=${() => (host.overflowOpen = false)}></div><div class="overflow-menu">${renderOverflowItem(
        () => {
            host.speedReadOpen = true;
            host.overflowOpen = false;
        },
        '⚡ Speed read',
    )}${renderOverflowItem(() => {
        void host.openBoardPicker();
        host.overflowOpen = false;
    }, '📋 Add to board')}${renderOverflowItem(() => {
        host.enqueueListen();
        host.overflowOpen = false;
    }, '🎧 Listen')}</div>`;
}

function renderOverflowItem(onSelect: () => void, label: string) {
    return html`<button class="btn" @click=${onSelect}>${label}</button>`;
}

export function renderOpenOriginal(a: Article, link: string) {
    return html`<a class="btn icon-btn primary" href=${link} target="_blank" rel="noopener noreferrer" aria-label="Open original" title="Open original" @click=${() => noteOriginal(a.id, a.title)}>${actionIcon('external')}</a>`;
}

/**
 * Compact share/copy actions: icon-only buttons with accessible labels.
 */
export function renderShareButtons(a: Article, link: string) {
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
    const buttons: Record<ShareTarget, unknown> = {
        facebook: html`<button class="btn icon-btn" @click=${open('facebook')} aria-label=${labels.facebook} title=${labels.facebook}>${shareIcon('facebook')}</button>`,
        x: html`<button class="btn icon-btn" @click=${open('x')} aria-label=${labels.x} title=${labels.x}>${shareIcon('x')}</button>`,
        mastodon: html`<button class="btn icon-btn" @click=${open('mastodon')} aria-label=${labels.mastodon} title=${labels.mastodon}>${shareIcon('mastodon')}</button>`,
        instagram: html`<button class="btn icon-btn" @click=${() => void copyLinkForInstagram(link, a)} aria-label=${labels.instagram} title=${labels.instagram}>${shareIcon('instagram')}</button>`,
    };
    return html`<div class="toolbar-group toolbar-share" aria-label="Share and copy">${loadShareTargets().map((t) => buttons[t])}${canNativeShare() ? html`<button class="btn icon-btn" @click=${() => void nativeShare(a, link)} aria-label="Share" title="Share">${actionIcon('share')}</button>` : ''}<button class="btn icon-btn" @click=${() => void copyTitleLink(a, link)} aria-label="Copy link" title="Copy link">${actionIcon('copy')}</button><button class="btn icon-btn" @click=${() => void copyMarkdownCitation(a, link)} aria-label="Copy markdown citation" title="Copy markdown citation">${actionIcon('markdown')}</button><button class="btn icon-btn" @click=${() => void copyQuoteCard(a, link)} aria-label="Copy quote card" title="Copy quote card">${actionIcon('quote')}</button><a class="btn icon-btn" href=${mailtoShareUrl(link, a.title)} @click=${() => noteShare(a.id, a.title)} aria-label="Email" title="Email">${actionIcon('mail')}</a></div>`;
}

export async function nativeShare(a: Article, link: string): Promise<void> {
    try {
        await navigator.share({ title: a.title, url: link });
        noteShare(a.id, a.title);
    } catch {
        // dismissed or unsupported mid-flight; nothing to report
    }
}
