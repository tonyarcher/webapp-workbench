/** Swap a folder with its neighbour. Out-of-range moves return the same order. */
export function movedFolderOrder(ids: readonly string[], index: number, delta: -1 | 1): string[] {
    const target = index + delta;
    if (index < 0 || index >= ids.length || target < 0 || target >= ids.length) return [...ids];
    const next = [...ids];
    next[index] = ids[target]!;
    next[target] = ids[index]!;
    return next;
}
