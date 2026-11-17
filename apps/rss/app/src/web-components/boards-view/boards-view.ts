import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { QueryController } from '../../query';
import { boardsKey, invalidateBoards } from '../../query';
import { fetchBoards } from '../../services/api';
import {
    createBoard as createBoardMutation,
    renameBoard as renameBoardMutation,
    removeBoard,
    reorderBoards as reorderBoardsMutation,
} from '../../mutations';
import { navigate } from '../../router';
import type { Board } from '../../types';
import styles from './boards-view.css?inline';

@customElement('boards-view')
export class BoardsView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private newTitle = '';
    @state() private draggingIndex = -1;

    private boards = new QueryController<Board[]>(this, () => ({
        queryKey: boardsKey(),
        queryFn: () => fetchBoards(),
        refetchInterval: 60_000,
    }));

    private get items(): Board[] {
        return this.boards.data ?? [];
    }

    private async onCreate() {
        const title = this.newTitle.trim();
        if (!title) return;
        const b = await createBoardMutation(title);
        if (b) {
            this.newTitle = '';
            await invalidateBoards();
        }
    }

    private async onRename(b: Board) {
        const next = window.prompt('Rename board', b.title);
        if (next === null) return;
        const t = next.trim();
        if (!t || t === b.title) return;
        await renameBoardMutation(b.id, t);
    }

    private async onDelete(b: Board) {
        if (!window.confirm(`Delete board "${b.title}"?`)) return;
        await removeBoard(b.id);
    }

    private async onDrop(targetIndex: number) {
        const from = this.draggingIndex;
        if (from < 0 || from === targetIndex) {
            this.draggingIndex = -1;
            return;
        }
        const list = [...this.items];
        const [moved] = list.splice(from, 1);
        if (moved) list.splice(targetIndex, 0, moved);
        this.draggingIndex = -1;
        await reorderBoardsMutation(list.map((b) => b.id));
    }

    private open(b: Board) {
        navigate({ kind: 'board', id: b.id });
    }

    override render() {
        const items = this.items;
        return html`
            <div class="view">
                <div class="toolbar">
                    <h2>Boards</h2>
                    <span class="meta">${items.length} board${items.length === 1 ? '' : 's'}</span>
                </div>
                <div class="create-row">
                    <input type="text" placeholder="New board name" .value=${this.newTitle}
                        @input=${(e: Event) => (this.newTitle = (e.target as HTMLInputElement).value)}
                        @keydown=${(e: KeyboardEvent) => {
                            if (e.key === 'Enter') void this.onCreate();
                        }} />
                    <button class="btn" @click=${() => void this.onCreate()}>Create</button>
                </div>
                <div class="body" tabindex="0">
                    ${!items.length ? html`<div class="empty">No boards yet. Create one above.</div>` : ''}
                    <ul class="list">
                        ${items.map(
                            (b, i) => html`
                            <li class="row" draggable="true"
                                @dragstart=${() => (this.draggingIndex = i)}
                                @dragover=${(e: DragEvent) => e.preventDefault()}
                                @drop=${() => void this.onDrop(i)}>
                                <button class="open" @click=${() => this.open(b)}>${b.title}</button>
                                <button class="btn" @click=${() => void this.onRename(b)}>Rename</button>
                                <button class="btn danger" @click=${() => void this.onDelete(b)}>Delete</button>
                            </li>
                        `,
                        )}
                    </ul>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'boards-view': BoardsView;
    }
}
