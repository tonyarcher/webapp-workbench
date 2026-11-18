import type { Article, Board } from '../../types';

export interface BoardPickerHost {
    boardPickerOpen: boolean;
    boards: Board[];
    boardMembership: Set<string>;
    newBoardTitle: string;
    setNewBoardTitle(value: string): void;
    close(): void;
    createBoard(): void;
    toggleMembership(board: Board, articleId: string): void;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
}

export function renderSpeedReadOverlay(open: boolean, text: string, close: () => void): Node[] {
    if (!open) return [];
    const overlay = document.createElement('div');
    overlay.className = 'speed-read-overlay';
    const view = document.createElement('speed-read-view') as HTMLElement & { text: string };
    view.text = text;
    view.addEventListener('close', (e: Event) => {
        e.stopPropagation();
        close();
    });
    overlay.appendChild(view);
    return [overlay];
}

export function renderBoardPicker(host: BoardPickerHost, a: Article): Node[] {
    if (!host.boardPickerOpen) return [];
    const nodes: Node[] = [];

    const backdrop = document.createElement('div');
    backdrop.className = 'board-picker-backdrop';
    backdrop.addEventListener('click', () => host.close());
    nodes.push(backdrop);

    const dialog = document.createElement('div');
    dialog.className = 'board-picker';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-label', 'Add to board');

    const head = document.createElement('div');
    head.className = 'board-picker-head';
    const heading = document.createElement('h3');
    heading.textContent = 'Boards';
    head.appendChild(heading);
    head.appendChild(button('btn', 'Close', () => host.close()));
    dialog.appendChild(head);

    const create = document.createElement('div');
    create.className = 'board-picker-create';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'New board';
    input.value = host.newBoardTitle;
    input.addEventListener('input', () => host.setNewBoardTitle(input.value));
    create.appendChild(input);
    create.appendChild(button('btn', 'Create', () => host.createBoard()));
    dialog.appendChild(create);

    const list = document.createElement('ul');
    list.className = 'board-picker-list';
    for (const b of host.boards) {
        const li = document.createElement('li');
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = host.boardMembership.has(b.id);
        checkbox.addEventListener('change', () => host.toggleMembership(b, a.id));
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(b.title));
        li.appendChild(label);
        list.appendChild(li);
    }
    dialog.appendChild(list);
    nodes.push(dialog);

    return nodes;
}
