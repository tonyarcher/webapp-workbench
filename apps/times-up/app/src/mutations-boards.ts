import {
    addToBoard as apiAddToBoard,
    createBoard as apiCreateBoard,
    deleteBoard as apiDeleteBoard,
    removeFromBoard as apiRemoveFromBoard,
    renameBoard as apiRenameBoard,
    reorderBoardEntries as apiReorderBoardEntries,
    reorderBoards as apiReorderBoards,
    setBoardNote as apiSetBoardNote,
} from './services/api';
import { invalidateBoard, invalidateBoards } from './query';
import { toastApiError } from './services/toast';

export async function createBoard(title: string): Promise<import('./types').Board | null> {
    try {
        const board = await apiCreateBoard(title);
        await invalidateBoards();
        return board;
    } catch (err) {
        toastApiError(err, 'Could not create board.');
        return null;
    }
}

export async function renameBoard(id: string, title: string): Promise<boolean> {
    try {
        await apiRenameBoard(id, title);
        await invalidateBoards();
        return true;
    } catch (err) {
        toastApiError(err, 'Could not rename board.');
        return false;
    }
}

export async function removeBoard(id: string): Promise<boolean> {
    try {
        await apiDeleteBoard(id);
        await invalidateBoards();
        await invalidateBoard(id);
        return true;
    } catch (err) {
        toastApiError(err, 'Could not delete board.');
        return false;
    }
}

export async function reorderBoards(ids: string[]): Promise<boolean> {
    try {
        await apiReorderBoards(ids);
        await invalidateBoards();
        return true;
    } catch (err) {
        toastApiError(err, 'Could not reorder boards.');
        return false;
    }
}

export async function addToBoard(boardId: string, articleId: string): Promise<boolean> {
    try {
        await apiAddToBoard(boardId, articleId);
        await invalidateBoard(boardId);
        window.dispatchEvent(new CustomEvent('boards-changed'));
        return true;
    } catch (err) {
        toastApiError(err, 'Could not add to board.');
        return false;
    }
}

export async function removeFromBoard(boardId: string, articleId: string): Promise<boolean> {
    try {
        await apiRemoveFromBoard(boardId, articleId);
        await invalidateBoard(boardId);
        window.dispatchEvent(new CustomEvent('boards-changed'));
        return true;
    } catch (err) {
        toastApiError(err, 'Could not remove from board.');
        return false;
    }
}

export async function saveBoardNote(boardId: string, articleId: string, note: string): Promise<boolean> {
    try {
        await apiSetBoardNote(boardId, articleId, note);
        await invalidateBoard(boardId);
        return true;
    } catch (err) {
        toastApiError(err, 'Could not save note.');
        return false;
    }
}

export async function reorderBoardEntries(boardId: string, articleIds: string[]): Promise<boolean> {
    try {
        await apiReorderBoardEntries(boardId, articleIds);
        await invalidateBoard(boardId);
        return true;
    } catch (err) {
        toastApiError(err, 'Could not reorder board entries.');
        return false;
    }
}
