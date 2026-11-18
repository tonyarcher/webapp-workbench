import {
    fetchBoardEntries,
    searchBoard,
    reorderBoardEntries,
    removeFromBoard,
    exportBoardOpml,
} from '../../services/api';
import { saveBoardNote } from '../../mutations';
import { domainOf, formatDate } from '../../util';
import type { Article, BoardEntry } from '../../types';
import styles from './board-view.css?inline';

function toArticle(e: BoardEntry): Article {
    return {
        id: e.articleId,
        feedId: e.feedId ?? 'board',
        guid: e.articleId,
        title: e.title,
        link: e.link,
        author: e.author,
        summary: e.summary,
        content: e.content,
        published: e.published ?? e.addedAt,
        fetchedAt: e.addedAt,
        read: 0,
        starred: false,
        popularity: 0,
        hot: 0,
    };
}

export class BoardView extends HTMLElement {
    private boardId = '';
    private q = '';
    private draggingIndex = -1;
    private entries: BoardEntry[] = [];
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.boardId = this.getAttribute('board-id') ?? '';
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        void this.load();
    }

    private async load() {
        try {
            this.entries = await fetchBoardEntries(this.boardId);
        } catch {
            this.entries = [];
        }
        this.paint();
    }

    private async runSearch() {
        const q = this.q.trim();
        if (!q) {
            await this.load();
            return;
        }
        try {
            this.entries = await searchBoard(this.boardId, q);
        } catch {
            // keep
        }
        this.paint();
    }

    private async onDrop(targetIndex: number) {
        const from = this.draggingIndex;
        if (from < 0 || from === targetIndex) {
            this.draggingIndex = -1;
            return;
        }
        const list = [...this.entries];
        const [moved] = list.splice(from, 1);
        if (moved) list.splice(targetIndex, 0, moved);
        this.draggingIndex = -1;
        await reorderBoardEntries(
            this.boardId,
            list.map((x) => x.articleId),
        );
        await this.load();
    }

    private async removeEntry(articleId: string) {
        await removeFromBoard(this.boardId, articleId);
        await this.load();
    }

    private async exportOpml() {
        const xml = await exportBoardOpml(this.boardId);
        const blob = new Blob([xml], { type: 'text/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'board.opml';
        a.click();
        URL.revokeObjectURL(url);
    }

    private async exportCaseFile() {
        const items = this.entries;
        const lines: string[] = [];
        lines.push('# Board case file');
        lines.push('');
        lines.push(`Exported ${items.length} pinned article${items.length === 1 ? '' : 's'}.`);
        lines.push('');
        for (const e of items) {
            lines.push(`## ${e.title}`);
            lines.push('');
            if (e.feedTitle) lines.push(`*Source: ${e.feedTitle}*`);
            if (e.link) lines.push(`*Link: ${e.link}*`);
            lines.push('');
            if (e.note) {
                lines.push('**Note:**');
                lines.push(e.note);
                lines.push('');
            }
            if (e.summary) lines.push(e.summary);
            lines.push('');
            lines.push('---');
            lines.push('');
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'case-file.md';
        a.click();
        URL.revokeObjectURL(url);
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Board';
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = `${this.entries.length} item${this.entries.length === 1 ? '' : 's'}`;
        const search = document.createElement('input');
        search.className = 'search';
        search.type = 'search';
        search.placeholder = 'Search this board';
        search.value = this.q;
        search.addEventListener('input', (e) => {
            this.q = (e.target as HTMLInputElement).value;
        });
        search.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter') void this.runSearch();
        });
        const exportOpmlBtn = document.createElement('button');
        exportOpmlBtn.className = 'btn';
        exportOpmlBtn.textContent = 'Export OPML';
        exportOpmlBtn.addEventListener('click', () => void this.exportOpml());
        const exportCaseBtn = document.createElement('button');
        exportCaseBtn.className = 'btn';
        exportCaseBtn.textContent = 'Export case file';
        exportCaseBtn.addEventListener('click', () => void this.exportCaseFile());
        toolbar.appendChild(h);
        toolbar.appendChild(meta);
        toolbar.appendChild(search);
        toolbar.appendChild(exportOpmlBtn);
        toolbar.appendChild(exportCaseBtn);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        if (!this.entries.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No pinned articles yet. Use “Add to board” while reading.';
            body.appendChild(empty);
        } else {
            const ul = document.createElement('ul');
            ul.className = 'list';
            this.entries.forEach((e, i) => {
                const li = document.createElement('li');
                li.className = 'row';
                li.draggable = true;
                li.addEventListener('dragstart', () => {
                    this.draggingIndex = i;
                });
                li.addEventListener('dragover', (ev) => ev.preventDefault());
                li.addEventListener('drop', () => void this.onDrop(i));
                const open = document.createElement('button');
                open.className = 'open';
                open.addEventListener('click', () => this.open(e));
                const title = document.createElement('span');
                title.className = 'title';
                title.textContent = e.title;
                open.appendChild(title);
                const metaLine = document.createElement('span');
                metaLine.className = 'meta-line';
                if (e.feedTitle) {
                    const ft = document.createElement('span');
                    ft.textContent = e.feedTitle;
                    metaLine.appendChild(ft);
                }
                if (e.link) {
                    const dom = document.createElement('span');
                    dom.textContent = domainOf(e.link);
                    metaLine.appendChild(dom);
                }
                const date = document.createElement('span');
                date.textContent = formatDate(e.published ?? e.addedAt);
                metaLine.appendChild(date);
                open.appendChild(metaLine);
                if (e.summary) {
                    const summary = document.createElement('span');
                    summary.className = 'summary';
                    summary.textContent = e.summary;
                    open.appendChild(summary);
                }
                li.appendChild(open);
                const note = document.createElement('textarea');
                note.className = 'note';
                note.placeholder = 'Note';
                note.value = e.note;
                note.addEventListener('blur', () => void saveBoardNote(this.boardId, e.articleId, note.value));
                li.appendChild(note);
                const remove = document.createElement('button');
                remove.className = 'btn danger';
                remove.textContent = 'Remove';
                remove.addEventListener('click', () => void this.removeEntry(e.articleId));
                li.appendChild(remove);
                ul.appendChild(li);
            });
            body.appendChild(ul);
        }
        this.root.appendChild(body);
    }

    private open(e: BoardEntry) {
        const article = toArticle(e);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: { article, index: 0, items: [article] },
                bubbles: true,
                composed: true,
            }),
        );
    }
}

customElements.define('board-view', BoardView);
