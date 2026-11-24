import { noteOriginal } from '../../mutations';
import { detectLanguage, LANGUAGE_NAMES } from '../../services/language';
import type { ArticleKeyword } from '../../services/keywords';
import { domainOf, formatDate, readMinutes } from '../../util';
import type { Article, RowHighlight } from '../../types';
import { whyLineFor, worthMinutesVerdict } from './article-view-helpers';
import { el, appendAll } from './article-view-dom';

/**
 * State and handlers the content builders read. The component passes itself
 * (`this as never`, matching the article-list render modules).
 */
export interface ArticleViewContentHost {
    article: Article | null;
    keywords: ArticleKeyword[];
    highlightsOn: boolean;
    keyLines: RowHighlight | null;
    keyLinesLoading: boolean;
    onToggleKeyLines(): void;
}

export function buildTitle(a: Article, link: string | undefined): Node[] {
    const h1 = el('h1');
    if (link) {
        const anchor = el('a', undefined, a.title);
        anchor.href = link;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.addEventListener('click', () => noteOriginal(a.id, a.title));
        h1.appendChild(anchor);
    } else {
        h1.textContent = a.title;
    }
    return [h1];
}

export function buildMeta(host: ArticleViewContentHost, a: Article): Node[] {
    const meta = el('div', 'meta');
    meta.appendChild(el('span', undefined, domainOf(a.link) || 'unknown source'));
    meta.appendChild(el('span', undefined, formatDate(a.published)));
    if (a.author) meta.appendChild(el('span', undefined, `by ${a.author}`));
    const minutes = readMinutes(a.content, a.summary);
    if (minutes > 0) meta.appendChild(el('span', undefined, `${minutes} min read`));
    const { verdict, why } = worthMinutesVerdict(a);
    const worth = el('span', 'worth-badge', verdict);
    worth.title = why;
    meta.appendChild(worth);
    const lang = detectLanguage(a.content ?? a.summary ?? '');
    if (lang !== 'en') {
        const badge = el('span', 'lang-badge', LANGUAGE_NAMES[lang] ?? lang);
        badge.title = 'Original language';
        meta.appendChild(badge);
    }
    appendAll(meta, buildHighlightsToggle(host));
    return [meta, ...buildKeywords(host)];
}

export function buildKeywords(host: ArticleViewContentHost): Node[] {
    if (!host.keywords.length) return [];
    const box = el('div', 'keywords');
    box.setAttribute('aria-label', 'Article keywords');
    box.appendChild(el('span', 'keywords-label', 'Keywords'));
    for (const k of host.keywords) box.appendChild(el('span', 'keyword', k.word));
    return [box];
}

export function buildKeyLines(host: ArticleViewContentHost): Node[] {
    if (!host.highlightsOn) return [];
    const result = host.keyLines;
    const has = !!result && result.available && result.excerpts.length > 0;
    const settledEmpty = !host.keyLinesLoading && !has;
    const section = el('section', 'key-lines');
    section.setAttribute('aria-label', 'Key lines');

    const head = el('div', 'key-lines-head');
    head.appendChild(el('h2', undefined, 'Key lines'));
    const hide = el('button', 'key-lines-toggle', 'Hide');
    hide.setAttribute('aria-pressed', String(host.highlightsOn));
    hide.addEventListener('click', () => host.onToggleKeyLines());
    head.appendChild(hide);
    section.appendChild(head);

    if (host.keyLinesLoading && !has) {
        section.appendChild(el('div', 'skl'));
        section.appendChild(el('div', 'skl skl-short'));
    }
    if (settledEmpty) section.appendChild(el('p', 'key-why', 'No key lines found for this article.'));
    if (has && result) {
        const list = el('ul');
        for (const e of result.excerpts) {
            const li = el('li');
            li.appendChild(el('blockquote', undefined, e.text));
            list.appendChild(li);
        }
        section.appendChild(list);
        section.appendChild(
            el('p', 'key-why', `From this article · ${whyLineFor(result, host.keywords, host.article)}`),
        );
    }
    return [section];
}

export function buildHighlightsToggle(host: ArticleViewContentHost): Node[] {
    if (host.highlightsOn) return [];
    const toggle = el('button', 'key-lines-toggle', 'Key lines');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.addEventListener('click', () => host.onToggleKeyLines());
    return [toggle];
}
