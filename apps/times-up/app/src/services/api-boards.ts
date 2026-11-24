import type { Board, BoardEntry } from '../types';
import { apiFetch, authedFetch, errorMessage } from './api-client';

export async function fetchBoards(): Promise<Board[]> {
    const data = await apiFetch('/boards');
    return (data as { items: Board[] }).items;
}
export async function createBoard(title: string): Promise<Board> {
    return apiFetch('/boards', { method: 'POST', body: JSON.stringify({ title }) }) as Promise<Board>;
}
export async function renameBoard(id: string, title: string): Promise<Board> {
    return apiFetch(`/boards/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: JSON.stringify({ title }),
    }) as Promise<Board>;
}
export async function deleteBoard(id: string): Promise<{ ok: true }> {
    return apiFetch(`/boards/${encodeURIComponent(id)}`, { method: 'DELETE' }) as Promise<{ ok: true }>;
}
export async function reorderBoards(ids: string[]): Promise<{ ok: true }> {
    return apiFetch('/boards/reorder', { method: 'POST', body: JSON.stringify({ ids }) }) as Promise<{ ok: true }>;
}
export async function fetchBoardEntries(boardId: string): Promise<BoardEntry[]> {
    const data = await apiFetch(`/boards/${encodeURIComponent(boardId)}/entries`);
    return (data as { items: BoardEntry[] }).items;
}
export async function addToBoard(boardId: string, articleId: string): Promise<BoardEntry> {
    return apiFetch(`/boards/${encodeURIComponent(boardId)}/entries`, {
        method: 'POST',
        body: JSON.stringify({ articleId }),
    }) as Promise<BoardEntry>;
}
export async function fetchBoardEntryContent(boardId: string, articleId: string): Promise<string | null> {
    const data = (await apiFetch(
        `/boards/${encodeURIComponent(boardId)}/entries/${encodeURIComponent(articleId)}/content`,
    )) as { content?: string | null };
    return data.content ?? null;
}

export async function removeFromBoard(boardId: string, articleId: string): Promise<{ ok: true }> {
    return apiFetch(`/boards/${encodeURIComponent(boardId)}/entries/${encodeURIComponent(articleId)}`, {
        method: 'DELETE',
    }) as Promise<{ ok: true }>;
}
export async function setBoardNote(boardId: string, articleId: string, note: string): Promise<BoardEntry> {
    return apiFetch(`/boards/${encodeURIComponent(boardId)}/entries/${encodeURIComponent(articleId)}`, {
        method: 'PUT',
        body: JSON.stringify({ note }),
    }) as Promise<BoardEntry>;
}
export async function reorderBoardEntries(boardId: string, articleIds: string[]): Promise<{ ok: true }> {
    return apiFetch(`/boards/${encodeURIComponent(boardId)}/entries/reorder`, {
        method: 'POST',
        body: JSON.stringify({ articleIds }),
    }) as Promise<{ ok: true }>;
}
export async function searchBoard(boardId: string, q: string): Promise<BoardEntry[]> {
    const data = await apiFetch(`/boards/${encodeURIComponent(boardId)}/search?q=${encodeURIComponent(q)}`);
    return (data as { items: BoardEntry[] }).items;
}
export async function exportBoardOpml(boardId: string): Promise<string> {
    const res = await authedFetch(`/boards/${encodeURIComponent(boardId)}/opml`);
    if (!res.ok) throw new Error(await errorMessage(res));
    return res.text();
}
