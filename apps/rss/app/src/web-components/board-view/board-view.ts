import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { QueryController } from '../../query';
import { boardEntriesKey, invalidateBoard } from '../../query';
import { fetchBoardEntries, searchBoard, removeFromBoard, exportBoardOpml } from '../../services/api';
import { reorderBoardEntries as reorderEntriesMutation, saveBoardNote } from '../../mutations';
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

@customElement('board-view')
export class BoardView extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() boardId = '';
    @state() private q = '';
    @state() private draggingIndex = -1;

    private entries = new QueryController<BoardEntry[]>(this, () => ({
        queryKey: boardEntriesKey(this.boardId, this.q.trim()),
        queryFn: () => (this.q.trim() ? searchBoard(this.boardId, this.q.trim()) : fetchBoardEntries(this.boardId)),
        refetchInterval: 60_000,
    }));

    private get items(): BoardEntry[] {
        return this.entries.data ?? [];
    }

    override updated(changed: Map<string, unknown>) {
        if (changed.has('boardId')) {
            this.q = '';
        }
    }

    private onDragStart(e: DragEvent, index: number) {
        this.draggingIndex = index;
        e.dataTransfer?.setData('text/plain', String(index));
    }

    private onDragOver(e: DragEvent) {
        e.preventDefault();
    }

    private async onDrop(e: DragEvent, targetIndex: number) {
        e.preventDefault();
        const from = this.draggingIndex;
        if (from < 0 || from === targetIndex) {
            this.draggingIndex = -1;
            return;
        }
        const list = [...this.items];
        const [moved] = list.splice(from, 1);
        if (moved) list.splice(targetIndex, 0, moved);
        const ids = list.map((x) => x.articleId);
        this.draggingIndex = -1;
        await reorderEntriesMutation(this.boardId, ids);
        await invalidateBoard(this.boardId);
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

    private async removeEntry(articleId: string) {
        await removeFromBoard(this.boardId, articleId);
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

    override render() {
        const items = this.items;
        return html`
            <div class="view">
                <div class="toolbar">
                    <h2>Board</h2>
                    <span class="meta">${items.length} item${items.length === 1 ? '' : 's'}</span>
                    <input class="search" type="search" placeholder="Search this board" .value=${this.q}
                        @input=${(e: Event) => {
                            this.q = (e.target as HTMLInputElement).value;
                        }} />
                    <button class="btn" @click=${() => void this.exportOpml()}>Export OPML</button>
                </div>
                <div class="body" tabindex="0">
                    ${!items.length ? html`<div class="empty">No pinned articles yet. Use “Add to board” while reading.</div>` : ''}
                    <ul class="list">
                        ${items.map((e, i) => this.renderItem(e, i))}
                    </ul>
                </div>
            </div>
        `;
    }

    private renderItem(e: BoardEntry, index: number) {
        return html`
            <li class="row" draggable="true"
                @dragstart=${(ev: DragEvent) => this.onDragStart(ev, index)}
                @dragover=${this.onDragOver}
                @drop=${(ev: DragEvent) => void this.onDrop(ev, index)}>
                <button class="open" @click=${() => this.open(e)}>
                    <span class="title">${e.title}</span>
                    <span class="meta-line">
                        ${e.feedTitle ? html`<span>${e.feedTitle}</span>` : ''}
                        ${e.link ? html`<span>${domainOf(e.link)}</span>` : ''}
                        <span>${formatDate(e.published ?? e.addedAt)}</span>
                    </span>
                    ${e.summary ? html`<span class="summary">${e.summary}</span>` : ''}
                </button>
                <textarea class="note" placeholder="Note" .value=${e.note}
                    @blur=${(ev: FocusEvent) => void saveBoardNote(this.boardId, e.articleId, (ev.target as HTMLTextAreaElement).value)}></textarea>
                <button class="btn danger" @click=${() => void this.removeEntry(e.articleId)}>Remove</button>
            </li>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'board-view': BoardView;
    }
}
