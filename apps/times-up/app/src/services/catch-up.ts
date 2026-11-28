// Catch-me-up preferences and one-step undo (B6). Preferences are per folder or
// feed; undo is scoped to the same view and cleared on sign-out, so a batch can
// never be restored from an unrelated reading context.

import { safeLocalStorage } from './local-storage';
import type { View } from '../types';

export const CATCH_UP_BUDGETS = [5, 10, 15, 30] as const;
export const DEFAULT_CATCH_UP_BUDGET = 5;

export interface CatchUpUndo {
    readonly scope: string;
    readonly id: number;
    readonly ids: readonly string[];
}

let nextUndoId = 1;
let undo: CatchUpUndo | null = null;

export function catchUpScope(view: View): string {
    if (view.kind === 'feed') return `feed:${view.id}`;
    if (view.kind === 'folder' || view.kind === 'interesting') return `${view.kind}:${view.id}`;
    return view.kind;
}

function preferenceKey(view: View): string {
    return `times-up:catch-up:${catchUpScope(view)}`;
}

export function loadCatchUpBudget(view: View, storage?: Storage | null): number {
    const store = storage === undefined ? safeLocalStorage() : storage;
    if (!store) return DEFAULT_CATCH_UP_BUDGET;
    try {
        const value = Number(store.getItem(preferenceKey(view)));
        return CATCH_UP_BUDGETS.includes(value as (typeof CATCH_UP_BUDGETS)[number]) ? value : DEFAULT_CATCH_UP_BUDGET;
    } catch {
        return DEFAULT_CATCH_UP_BUDGET;
    }
}

export function saveCatchUpBudget(view: View, minutes: number, storage?: Storage | null): void {
    if (!CATCH_UP_BUDGETS.includes(minutes as (typeof CATCH_UP_BUDGETS)[number])) return;
    const store = storage === undefined ? safeLocalStorage() : storage;
    try {
        store?.setItem(preferenceKey(view), String(minutes));
    } catch {
        // The current page still uses the selected value.
    }
}

export function rememberCatchUpUndo(view: View, ids: readonly string[]): void {
    undo = { scope: catchUpScope(view), id: nextUndoId++, ids: [...ids] };
}

export function peekCatchUpUndo(view: View): CatchUpUndo | null {
    return undo?.scope === catchUpScope(view) ? undo : null;
}

/** Consume only the snapshot the caller saw, never a newer batch. */
export function consumeCatchUpUndo(view: View, id: number): boolean {
    if (undo?.scope !== catchUpScope(view) || undo.id !== id) return false;
    undo = null;
    return true;
}

export function clearCatchUpUndo(): void {
    undo = null;
}
