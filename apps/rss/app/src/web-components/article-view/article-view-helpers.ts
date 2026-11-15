import { svg } from 'lit';
import { articleKeywordsOf, type ArticleKeyword } from '../../services/keywords';
import { loadWordMap } from '../../services/interesting-settings';
import { noteShare } from '../../mutations';
import { toastError, toastInfo } from '../../services/toast';
import { readMinutes } from '../../util';
import type { Article, RowHighlight } from '../../types';
import type { ShareTarget } from '../../services/share';

export function articleKeywords(article: Article): ArticleKeyword[] {
    return articleKeywordsOf(article.title, article.summary, article.content, loadWordMap());
}

/** Assembled signal labels only; no generated sentence. */
export function whyLineFor(result: RowHighlight, keywords: ArticleKeyword[], article: Article | null): string {
    const parts: string[] = [];
    const learned = keywords
        .filter((k) => k.score !== 0)
        .slice(0, 4)
        .map((k) => `${k.word} ${k.score > 0 ? '+' : ''}${k.score}`);
    if (learned.length) parts.push(`learned: ${learned.join(', ')}`);
    if (result.interesting !== null && result.interesting !== undefined) {
        parts.push(`Jev interest ${Math.round(result.interesting * 100)}%`);
    }
    if (result.spam != null && result.spam >= 0.5) parts.push('looks like boilerplate');
    const minutes = readMinutes(article?.content ?? '', article?.summary);
    if (minutes > 0) parts.push(`${minutes} min read`);
    return parts.join(' · ') || 'selected key excerpts';
}

/**
 * Brand glyphs for the share buttons, drawn as inline SVG so no font or
 * image asset is needed. Decorative: the button text names the target.
 */
export function shareIcon(target: ShareTarget) {
    switch (target) {
        case 'facebook':
            return svg`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21.5v-7.2h2.5l.4-2.8h-2.9V9.7c0-.8.3-1.4 1.5-1.4h1.5V5.8c-.3 0-1.2-.1-2.2-.1-2.1 0-3.6 1.3-3.6 3.7v2.1H8.2v2.8h2.5v7.2h2.8z"/></svg>`;
        case 'x':
            return svg`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.4 4.8H5.6l11.1 14.3z"/></svg>`;
        case 'mastodon':
            return svg`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5c-3.9 0-6.8 2.4-6.8 5.8v4.3c0 2.9 1.9 5.2 4.6 5.2.5 0 1-.1 1.4-.2l.8 2.4.8-2.4c.4.1.9.2 1.4.2 2.7 0 4.6-2.3 4.6-5.2V8.3c0-3.4-2.9-5.8-6.8-5.8zM9.3 15.6c-.4-.9-.6-1.9-.6-2.9h1.5c0 .8.2 1.6.5 2.3l-1.4.6zm5.4 0l-1.4-.6c.3-.7.5-1.5.5-2.3h1.5c0 1-.2 2-.6 2.9z"/></svg>`;
        case 'instagram':
            return svg`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>`;
    }
}

/** Clipboard with the legacy textarea fallback for older WebViews. */
export async function copyText(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const area = document.createElement('textarea');
            area.value = text;
            document.body.appendChild(area);
            area.select();
            const copied = document.execCommand('copy');
            area.remove();
            return copied;
        } catch {
            return false;
        }
    }
}

export async function copyTitleLink(a: Article, link: string): Promise<void> {
    if (await copyText(`${a.title}\n${link}`)) {
        noteShare(a.id, a.title);
        toastInfo('Link copied');
    } else {
        toastError('Could not copy the link');
    }
}

export async function copyLinkForInstagram(link: string, a: Article): Promise<void> {
    if (await copyText(link)) {
        noteShare(a.id, a.title);
        toastInfo('Link copied - paste it in Instagram');
    } else {
        toastError('Could not copy the link');
    }
}
