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

export class BoardsView extends HTMLElement {
    private newTitle = '';
    private draggingIndex = -1;
    private boards: Board[] = [];
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        void this.load();
    }

    private async load() {
        try {
            this.boards = await fetchBoards();
        } catch {
            this.boards = [];
        }
        this.paint();
    }

    private async onCreate() {
        const title = this.newTitle.trim();
        if (!title) return;
        const b = await createBoardMutation(title);
        if (b) {
            this.newTitle = '';
            await this.load();
        }
    }

    private async onRename(b: Board) {
        const next = window.prompt('Rename board', b.title);
        if (next === null) return;
        const t = next.trim();
        if (!t || t === b.title) return;
        await renameBoardMutation(b.id, t);
        await this.load();
    }

    private async onDelete(b: Board) {
        if (!window.confirm(`Delete board "${b.title}"?`)) return;
        await removeBoard(b.id);
        await this.load();
    }

    private async onDrop(targetIndex: number) {
        const from = this.draggingIndex;
        if (from < 0 || from === targetIndex) {
            this.draggingIndex = -1;
            return;
        }
        const list = [...this.boards];
        const [moved] = list.splice(from, 1);
        if (moved) list.splice(targetIndex, 0, moved);
        this.draggingIndex = -1;
        await reorderBoardsMutation(list.map((b) => b.id));
        await this.load();
    }

    private open(b: Board) {
        navigate({ kind: 'board', id: b.id });
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Boards';
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = `${this.boards.length} board${this.boards.length === 1 ? '' : 's'}`;
        toolbar.appendChild(h);
        toolbar.appendChild(meta);
        this.root.appendChild(toolbar);
        const createRow = document.createElement('div');
        createRow.className = 'create-row';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'New board name';
        input.value = this.newTitle;
        input.addEventListener('input', (e) => {
            this.newTitle = (e.target as HTMLInputElement).value;
        });
        input.addEventListener('keydown', (e) => {
            if ((e as KeyboardEvent).key === 'Enter') void this.onCreate();
        });
        const createBtn = document.createElement('button');
        createBtn.className = 'btn';
        createBtn.textContent = 'Create';
        createBtn.addEventListener('click', () => void this.onCreate());
        createRow.appendChild(input);
        createRow.appendChild(createBtn);
        this.root.appendChild(createRow);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        if (!this.boards.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No boards yet. Create one above.';
            body.appendChild(empty);
        } else {
            const ul = document.createElement('ul');
            ul.className = 'list';
            this.boards.forEach((b, i) => {
                const li = document.createElement('li');
                li.className = 'row';
                li.draggable = true;
                li.addEventListener('dragstart', () => {
                    this.draggingIndex = i;
                });
                li.addEventListener('dragover', (e) => e.preventDefault());
                li.addEventListener('drop', () => void this.onDrop(i));
                const openBtn = document.createElement('button');
                openBtn.className = 'open';
                openBtn.textContent = b.title;
                openBtn.addEventListener('click', () => this.open(b));
                const renameBtn = document.createElement('button');
                renameBtn.className = 'btn';
                renameBtn.textContent = 'Rename';
                renameBtn.addEventListener('click', () => void this.onRename(b));
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn danger';
                deleteBtn.textContent = 'Delete';
                deleteBtn.addEventListener('click', () => void this.onDelete(b));
                li.appendChild(openBtn);
                li.appendChild(renameBtn);
                li.appendChild(deleteBtn);
                ul.appendChild(li);
            });
            body.appendChild(ul);
        }
        this.root.appendChild(body);
    }
}

customElements.define('boards-view', BoardsView);
