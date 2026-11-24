import { articleKeywordsOf, type ArticleKeyword } from '../../services/keywords';
import { loadWordMap } from '../../services/interesting-settings';
import { noteShare } from '../../mutations';
import { toastError, toastInfo } from '../../services/toast';
import { readMinutes } from '../../util';
import type { Article, RowHighlight } from '../../types';
import type { ShareTarget } from '../../services/share';
import { copyImageBlob, downloadBlob, formatMarkdownCitation, renderQuoteCard } from '../../services/citation';

export function articleKeywords(article: Article): ArticleKeyword[] {
    return articleKeywordsOf(article.title, article.summary, article.content, loadWordMap());
}

/** Assembled signal labels only; no generated sentence. */
export function worthMinutesVerdict(article: Article): { verdict: string; why: string } {
    const minutes = readMinutes(article.content, article.summary);
    const interest = article.scores?.interest ?? 0;
    const worthy = article.scores?.worthy ?? 0;
    const score = interest * 0.6 + worthy * 0.4;
    let verdict = 'Maybe';
    if (score >= 0.7) verdict = 'Worth it';
    else if (score < 0.3) verdict = 'Skip';
    const why = `Read time ${minutes} min; interest ${(interest * 100).toFixed(0)}%; worthiness ${(worthy * 100).toFixed(0)}%.`;
    return { verdict, why };
}
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

type SvgAttrs = Record<string, string>;

/** Build one SVG element with the given attributes and children. */
function svgNode(tag: string, attrs: SvgAttrs = {}, children: SVGElement[] = []): SVGElement {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
    for (const child of children) el.appendChild(child);
    return el;
}

const ROOT_VIEW = { viewBox: '0 0 24 24', 'aria-hidden': 'true' };
const STROKED = {
    ...ROOT_VIEW,
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
};
const STAR_PATH = 'M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z';

/**
 * Brand glyphs for the share buttons, drawn as inline SVG so no font or
 * image asset is needed. Decorative: the button text names the target.
 */
export function shareIcon(target: ShareTarget): SVGElement {
    switch (target) {
        case 'facebook':
            return svgNode('svg', ROOT_VIEW, [
                svgNode('path', {
                    fill: 'currentColor',
                    d: 'M13.5 21.5v-7.2h2.5l.4-2.8h-2.9V9.7c0-.8.3-1.4 1.5-1.4h1.5V5.8c-.3 0-1.2-.1-2.2-.1-2.1 0-3.6 1.3-3.6 3.7v2.1H8.2v2.8h2.5v7.2h2.8z',
                }),
            ]);
        case 'x':
            return svgNode('svg', ROOT_VIEW, [
                svgNode('path', {
                    fill: 'currentColor',
                    d: 'M17.8 3h3.1l-6.8 7.8L22 21h-6.3l-4.9-6.4L5.2 21H2.1l7.3-8.3L2 3h6.4l4.4 5.9L17.8 3zm-1.1 16.1h1.7L7.4 4.8H5.6l11.1 14.3z',
                }),
            ]);
        case 'mastodon':
            return svgNode('svg', ROOT_VIEW, [
                svgNode('path', {
                    fill: 'currentColor',
                    d: 'M12 2.5c-3.9 0-6.8 2.4-6.8 5.8v4.3c0 2.9 1.9 5.2 4.6 5.2.5 0 1-.1 1.4-.2l.8 2.4.8-2.4c.4.1.9.2 1.4.2 2.7 0 4.6-2.3 4.6-5.2V8.3c0-3.4-2.9-5.8-6.8-5.8zM9.3 15.6c-.4-.9-.6-1.9-.6-2.9h1.5c0 .8.2 1.6.5 2.3l-1.4.6zm5.4 0l-1.4-.6c.3-.7.5-1.5.5-2.3h1.5c0 1-.2 2-.6 2.9z',
                }),
            ]);
        case 'instagram':
            return svgNode(
                'svg',
                {
                    ...ROOT_VIEW,
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '1.8',
                },
                [
                    svgNode('rect', { x: '3.5', y: '3.5', width: '17', height: '17', rx: '5' }),
                    svgNode('circle', { cx: '12', cy: '12', r: '3.8' }),
                    svgNode('circle', { cx: '17', cy: '7', r: '1.2', fill: 'currentColor', stroke: 'none' }),
                ],
            );
    }
}

export function actionIcon(
    name:
        | 'back'
        | 'star'
        | 'starred'
        | 'read'
        | 'unread'
        | 'save'
        | 'saved'
        | 'derank'
        | 'deranked'
        | 'copy'
        | 'markdown'
        | 'quote'
        | 'mail'
        | 'external'
        | 'more'
        | 'share'
        | 'search',
): SVGElement {
    switch (name) {
        case 'back':
            return svgNode(
                'svg',
                {
                    ...ROOT_VIEW,
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2',
                    'stroke-linecap': 'round',
                    'stroke-linejoin': 'round',
                },
                [svgNode('path', { d: 'M15 18l-6-6 6-6' }), svgNode('path', { d: 'M10 12h9' })],
            );
        case 'star':
            return svgNode('svg', { ...ROOT_VIEW, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
                svgNode('path', { d: STAR_PATH }),
            ]);
        case 'starred':
            return svgNode('svg', ROOT_VIEW, [svgNode('path', { fill: 'currentColor', d: STAR_PATH })]);
        case 'read':
            return svgNode('svg', STROKED, [
                svgNode('path', { d: 'M4 6.5h16v11H4z' }),
                svgNode('path', { d: 'M4 8l8 6 8-6' }),
            ]);
        case 'unread':
            return svgNode('svg', STROKED, [
                svgNode('circle', { cx: '12', cy: '12', r: '8.5' }),
                svgNode('circle', { cx: '12', cy: '12', r: '2.2', fill: 'currentColor', stroke: 'none' }),
            ]);
        case 'save':
            return svgNode('svg', { ...ROOT_VIEW, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' }, [
                svgNode('path', { d: 'M6 4.5h12v15l-6-3.5-6 3.5z' }),
            ]);
        case 'saved':
            return svgNode('svg', ROOT_VIEW, [
                svgNode('path', { fill: 'currentColor', d: 'M6 4.5h12v15l-6-3.5-6 3.5z' }),
            ]);
        case 'derank':
            return svgNode('svg', STROKED, [svgNode('path', { d: STAR_PATH }), svgNode('path', { d: 'M4 4l16 16' })]);
        case 'deranked':
            return svgNode('svg', ROOT_VIEW, [
                svgNode('path', { fill: 'currentColor', d: STAR_PATH }),
                svgNode('path', {
                    d: 'M4 4l16 16',
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-width': '2.2',
                    'stroke-linecap': 'round',
                }),
            ]);
        case 'copy':
            return svgNode('svg', STROKED, [
                svgNode('rect', { x: '9', y: '9', width: '10', height: '11', rx: '2' }),
                svgNode('path', { d: 'M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1' }),
            ]);
        case 'markdown':
            return svgNode('svg', STROKED, [
                svgNode('rect', { x: '3.5', y: '5', width: '17', height: '14', rx: '2' }),
                svgNode('path', { d: 'M7 15V9l2.5 3L12 9v6' }),
                svgNode('path', { d: 'M16 9v6m0 0l-2-2m2 2l2-2' }),
            ]);
        case 'quote':
            return svgNode('svg', STROKED, [
                svgNode('rect', { x: '3.5', y: '4.5', width: '17', height: '15', rx: '2' }),
                svgNode('path', { d: 'M7.5 14h3l-1 2M13.5 14h3l-1 2' }),
            ]);
        case 'mail':
            return svgNode('svg', STROKED, [
                svgNode('rect', { x: '3.5', y: '5.5', width: '17', height: '13', rx: '2' }),
                svgNode('path', { d: 'M4 7l8 6 8-6' }),
            ]);
        case 'external':
            return svgNode('svg', STROKED, [
                svgNode('path', { d: 'M14 5h5v5' }),
                svgNode('path', { d: 'M10 14L19 5' }),
                svgNode('path', { d: 'M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4' }),
            ]);
        case 'more':
            return svgNode('svg', ROOT_VIEW, [
                svgNode('circle', { cx: '6', cy: '12', r: '1.8', fill: 'currentColor' }),
                svgNode('circle', { cx: '12', cy: '12', r: '1.8', fill: 'currentColor' }),
                svgNode('circle', { cx: '18', cy: '12', r: '1.8', fill: 'currentColor' }),
            ]);
        case 'share':
            return svgNode('svg', STROKED, [
                svgNode('path', { d: 'M12 3v12' }),
                svgNode('path', { d: 'M8 7l4-4 4 4' }),
                svgNode('rect', { x: '5', y: '11', width: '14', height: '10', rx: '2' }),
            ]);
        case 'search':
            return svgNode('svg', STROKED, [
                svgNode('circle', { cx: '10.5', cy: '10.5', r: '6.5' }),
                svgNode('path', { d: 'M15.5 15.5L21 21' }),
            ]);
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

export async function copyMarkdownCitation(a: Article, link: string): Promise<void> {
    const text = formatMarkdownCitation(a, link);
    if (await copyText(text)) {
        noteShare(a.id, a.title);
        toastInfo('Markdown citation copied');
    } else {
        toastError('Could not copy citation');
    }
}

export async function copyQuoteCard(a: Article, link: string): Promise<void> {
    try {
        const blob = await renderQuoteCard(a, link);
        const copied = await copyImageBlob(blob);
        if (copied) {
            noteShare(a.id, a.title);
            toastInfo('Quote card copied');
            return;
        }
        const name = `${
            (a.title || 'quote')
                .replace(/[^a-z0-9]+/gi, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 40) || 'quote'
        }.png`;
        downloadBlob(blob, name);
        noteShare(a.id, a.title);
        toastInfo('Quote card downloaded');
    } catch {
        toastError('Could not create quote card');
    }
}
