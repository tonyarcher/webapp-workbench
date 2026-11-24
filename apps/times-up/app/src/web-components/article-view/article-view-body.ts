import { noteOriginal } from '../../mutations';
import { detectLanguage, LANGUAGE_NAMES } from '../../services/language';
import type { ArticleKeyword } from '../../services/keywords';
import { domainOf, formatDate, readMinutes } from '../../util';
import type { Article, Board, HighlightExcerpt, RowHighlight } from '../../types';
import { whyLineFor, worthMinutesVerdict } from './article-view-helpers';
import { renderBoardPicker as renderBoardPickerOverlay } from './article-view-overlays';

/**
 * State the body builders read. The component passes itself, so the markup is
 * the same markup the class built before the split.
 */
export interface ArticleViewBodyHost {
    keywords: ArticleKeyword[];
    highlightsOn: boolean;
    keyLines: RowHighlight | null;
    keyLinesLoading: boolean;
    onToggleKeyLines(): void;
}

/** Board-picker state the overlay in article-view-overlays.ts is wired to. */
export interface ArticleViewBoardHost {
    boardPickerOpen: boolean;
    boards: Board[];
    boardMembership: Set<string>;
    newBoardTitle: string;
    createBoardFromPicker(): Promise<void>;
    toggleBoardMembership(board: Board, articleId: string): Promise<void>;
}

function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className?: string,
    text?: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export function renderTitle(a: Article, link: string | undefined): Node[] {
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

export function renderMeta(host: ArticleViewBodyHost, a: Article): Node[] {
    const meta = el('div', 'meta');
    for (const node of renderSource(a)) meta.appendChild(node);
    for (const node of renderPublished(a)) meta.appendChild(node);
    for (const node of renderAuthor(a)) meta.appendChild(node);
    for (const node of renderReadTime(a)) meta.appendChild(node);
    for (const node of renderWorthBadge(a)) meta.appendChild(node);
    for (const node of renderLangBadge(a)) meta.appendChild(node);
    for (const node of renderHighlightsToggle(host)) meta.appendChild(node);
    return [meta, ...renderKeywords(host)];
}

function renderPublished(a: Article): Node[] {
    return [el('span', undefined, formatDate(a.published))];
}

function renderSource(a: Article): Node[] {
    return [el('span', undefined, domainOf(a.link) || 'unknown source')];
}

function renderAuthor(a: Article): Node[] {
    if (!a.author) return [];
    return [el('span', undefined, `by ${a.author}`)];
}

function renderReadTime(a: Article): Node[] {
    const minutes = readMinutes(a.content, a.summary);
    if (minutes <= 0) return [];
    return [el('span', undefined, `${minutes} min read`)];
}

function renderWorthBadge(a: Article): Node[] {
    const { verdict, why } = worthMinutesVerdict(a);
    const span = el('span', 'worth-badge', verdict);
    span.title = why;
    return [span];
}

function renderLangBadge(a: Article): Node[] {
    const lang = detectLanguage(a.content ?? a.summary ?? '');
    if (lang === 'en') return [];
    const span = el('span', 'lang-badge', LANGUAGE_NAMES[lang] ?? lang);
    span.title = 'Original language';
    return [span];
}

export function renderKeywords(host: ArticleViewBodyHost): Node[] {
    if (!host.keywords.length) return [];
    const box = el('div', 'keywords');
    box.setAttribute('aria-label', 'Article keywords');
    box.appendChild(el('span', 'keywords-label', 'Keywords'));
    for (const k of host.keywords) box.appendChild(el('span', 'keyword', k.word));
    return [box];
}

export function renderBoardPicker(host: ArticleViewBoardHost, a: Article): Node[] {
    return renderBoardPickerOverlay(
        {
            boardPickerOpen: host.boardPickerOpen,
            boards: host.boards,
            boardMembership: host.boardMembership,
            newBoardTitle: host.newBoardTitle,
            setNewBoardTitle: (value) => (host.newBoardTitle = value),
            close: () => (host.boardPickerOpen = false),
            createBoard: () => void host.createBoardFromPicker(),
            toggleMembership: (b, id) => void host.toggleBoardMembership(b, id),
        },
        a,
    );
}

export function renderBody(body: string, a: Article): Node[] {
    // sanitized: `body` is sanitizeHtml(article.content), run by the component's paint().
    if (body) {
        const content = el('div', 'content');
        content.innerHTML = body;
        return [content];
    }
    if (a.summary) return [el('div', 'content', a.summary)];
    return [el('p', 'content', 'No content available for this article.')];
}

export function renderKeyLines(host: ArticleViewBodyHost, a: Article): Node[] {
    if (!host.highlightsOn) return [];
    const excerpts = host.keyLines && host.keyLines.available ? host.keyLines.excerpts : [];
    const has = excerpts.length > 0;
    const settledEmpty = !host.keyLinesLoading && !has;
    const section = el('section', 'key-lines');
    section.setAttribute('aria-label', 'Key lines');
    for (const node of renderKeyLinesHead(host)) section.appendChild(node);
    for (const node of renderKeyLinesLoading(host, has)) section.appendChild(node);
    for (const node of renderKeyLinesEmpty(settledEmpty)) section.appendChild(node);
    for (const node of renderKeyLinesList(host, a, has, excerpts)) section.appendChild(node);
    return [section];
}

function renderKeyLinesHead(host: ArticleViewBodyHost): Node[] {
    const head = el('div', 'key-lines-head');
    head.appendChild(el('h2', undefined, 'Key lines'));
    const toggle = el('button', 'key-lines-toggle', 'Hide');
    toggle.setAttribute('aria-pressed', String(host.highlightsOn));
    toggle.addEventListener('click', host.onToggleKeyLines);
    head.appendChild(toggle);
    return [head];
}

function renderKeyLinesLoading(host: ArticleViewBodyHost, has: boolean): Node[] {
    if (!host.keyLinesLoading || has) return [];
    return [el('div', 'skl'), el('div', 'skl skl-short')];
}

function renderKeyLinesEmpty(settledEmpty: boolean): Node[] {
    if (!settledEmpty) return [];
    return [el('p', 'key-why', 'No key lines found for this article.')];
}

function renderKeyLinesList(host: ArticleViewBodyHost, a: Article, has: boolean, excerpts: HighlightExcerpt[]): Node[] {
    const result = host.keyLines;
    if (!has || !result) return [];
    const list = el('ul');
    for (const e of excerpts) {
        const li = el('li');
        li.appendChild(el('blockquote', undefined, e.text));
        list.appendChild(li);
    }
    return [list, el('p', 'key-why', `From this article · ${whyLineFor(result, host.keywords, a)}`)];
}

export function renderHighlightsToggle(host: ArticleViewBodyHost): Node[] {
    if (host.highlightsOn) return [];
    const toggle = el('button', 'key-lines-toggle', 'Key lines');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.addEventListener('click', host.onToggleKeyLines);
    return [toggle];
}
