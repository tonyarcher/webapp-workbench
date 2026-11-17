import { html } from 'lit';
import type { Article, Board } from '../../types';

export interface BoardPickerHost {
    boardPickerOpen: boolean;
    boards: Board[];
    boardMembership: Set<string>;
    newBoardTitle: string;
    close(): void;
    createBoard(): void;
    toggleMembership(board: Board, articleId: string): void;
}

export function renderSpeedReadOverlay(open: boolean, text: string, close: () => void) {
    if (!open) return '';
    return html`<div class="speed-read-overlay"><speed-read-view .text=${text} @close=${(e: Event) => {
        e.stopPropagation();
        close();
    }}></speed-read-view></div>`;
}

export function renderBoardPicker(host: BoardPickerHost, a: Article) {
    if (!host.boardPickerOpen) return '';
    return html`
        <div class="board-picker-backdrop" @click=${() => host.close()}></div>
        <div class="board-picker" role="dialog" aria-label="Add to board">
            <div class="board-picker-head"><h3>Boards</h3><button class="btn" @click=${() => host.close()}>Close</button></div>
            <div class="board-picker-create">
                <input type="text" placeholder="New board" .value=${host.newBoardTitle} @input=${(e: Event) => (host.newBoardTitle = (e.target as HTMLInputElement).value)} />
                <button class="btn" @click=${() => host.createBoard()}>Create</button>
            </div>
            <ul class="board-picker-list">${host.boards.map((b) => html`<li><label><input type="checkbox" .checked=${host.boardMembership.has(b.id)} @change=${() => host.toggleMembership(b, a.id)} />${b.title}</label></li>`)}</ul>
        </div>
    `;
}
