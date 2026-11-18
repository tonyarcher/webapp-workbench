import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { noteOriginal } from '../../mutations';
import { detectLanguage, LANGUAGE_NAMES } from '../../services/language';
import type { ArticleKeyword } from '../../services/keywords';
import { domainOf, formatDate, readMinutes } from '../../util';
import type { Article, Board, HighlightExcerpt, RowHighlight } from '../../types';
import { whyLineFor, worthMinutesVerdict } from './article-view-helpers';
import { renderBoardPicker as renderBoardPickerOverlay } from './article-view-overlays';

/**
 * State the body templates read. The component passes itself, so the markup is
 * the same markup the class rendered before the split.
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

export function renderTitle(a: Article, link: string | undefined) {
    return html`<h1>${link ? html`<a href=${link} target="_blank" rel="noopener noreferrer" @click=${() => noteOriginal(a.id, a.title)}>${a.title}</a>` : a.title}</h1>`;
}

export function renderMeta(host: ArticleViewBodyHost, a: Article) {
    return html`<div class="meta">${renderSource(a)}${renderPublished(a)}${renderAuthor(a)}${renderReadTime(a)}${renderWorthBadge(a)}${renderLangBadge(a)}${renderHighlightsToggle(host)}</div>${renderKeywords(host)}`;
}

function renderPublished(a: Article) {
    return html`<span>${formatDate(a.published)}</span>`;
}

function renderSource(a: Article) {
    return html`<span>${domainOf(a.link) || 'unknown source'}</span>`;
}

function renderAuthor(a: Article) {
    if (!a.author) return '';
    return html`<span>by ${a.author}</span>`;
}

function renderReadTime(a: Article) {
    const minutes = readMinutes(a.content, a.summary);
    if (minutes <= 0) return '';
    return html`<span>${minutes} min read</span>`;
}

function renderWorthBadge(a: Article) {
    const { verdict, why } = worthMinutesVerdict(a);
    return html`<span class="worth-badge" title=${why}>${verdict}</span>`;
}

function renderLangBadge(a: Article) {
    const lang = detectLanguage(a.content ?? a.summary ?? '');
    if (lang === 'en') return '';
    return html`<span class="lang-badge" title="Original language">${LANGUAGE_NAMES[lang] ?? lang}</span>`;
}

export function renderKeywords(host: ArticleViewBodyHost) {
    if (!host.keywords.length) return '';
    return html`<div class="keywords" aria-label="Article keywords"><span class="keywords-label">Keywords</span>${host.keywords.map((k) => html`<span class="keyword">${k.word}</span>`)}</div>`;
}

export function renderBoardPicker(host: ArticleViewBoardHost, a: Article) {
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

export function renderBody(body: string, a: Article) {
    // sanitized: `body` is sanitizeHtml(article.content), run by the component's render().
    if (body) return html`<div class="content">${unsafeHTML(body)}</div>`;
    if (a.summary) return html`<div class="content">${a.summary}</div>`;
    return html`<p class="content">No content available for this article.</p>`;
}

export function renderKeyLines(host: ArticleViewBodyHost, a: Article) {
    if (!host.highlightsOn) return '';
    const excerpts = host.keyLines && host.keyLines.available ? host.keyLines.excerpts : [];
    const has = excerpts.length > 0;
    const settledEmpty = !host.keyLinesLoading && !has;
    return html`<section class="key-lines" aria-label="Key lines">${renderKeyLinesHead(host)}${renderKeyLinesLoading(host, has)}${renderKeyLinesEmpty(settledEmpty)}${renderKeyLinesList(host, a, has, excerpts)}</section>`;
}

function renderKeyLinesHead(host: ArticleViewBodyHost) {
    return html`<div class="key-lines-head"><h2>Key lines</h2><button class="key-lines-toggle" @click=${host.onToggleKeyLines} aria-pressed=${host.highlightsOn}>Hide</button></div>`;
}

function renderKeyLinesLoading(host: ArticleViewBodyHost, has: boolean) {
    if (!host.keyLinesLoading || has) return '';
    return html`<div class="skl"></div><div class="skl skl-short"></div>`;
}

function renderKeyLinesEmpty(settledEmpty: boolean) {
    if (!settledEmpty) return '';
    return html`<p class="key-why">No key lines found for this article.</p>`;
}

function renderKeyLinesList(host: ArticleViewBodyHost, a: Article, has: boolean, excerpts: HighlightExcerpt[]) {
    const result = host.keyLines;
    if (!has || !result) return '';
    return html`<ul>${repeat(
        excerpts,
        (e) => e.index,
        (e) => html`<li><blockquote>${e.text}</blockquote></li>`,
    )}</ul><p class="key-why">From this article · ${whyLineFor(result, host.keywords, a)}</p>`;
}

export function renderHighlightsToggle(host: ArticleViewBodyHost) {
    if (host.highlightsOn) return '';
    return html`<button class="key-lines-toggle" @click=${host.onToggleKeyLines} aria-pressed="false">Key lines</button>`;
}
