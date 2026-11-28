// One guarded handle on `localStorage`. Private mode and a disabled store throw
// on access, and a preference is never worth breaking a panel over.

export function safeLocalStorage(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        return null;
    }
}
