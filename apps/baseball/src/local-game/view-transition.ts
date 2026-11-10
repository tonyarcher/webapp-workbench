/**
 * Screen swaps as a same-document view transition, with two escape hatches.
 *
 * The setup <-> game swap otherwise cuts instantly. Wrapping the render in
 * document.startViewTransition crossfades the old screen out and the new one
 * in. Anything else keeps the cut: browsers without the API, and users who
 * ask for reduced motion (the platform leaves that check to the author).
 *
 * The callback's return value passes through so async renders (Lit's
 * requestUpdate promise) settle inside the transition instead of racing it.
 * A rejected transition (interrupted by a second navigation) is swallowed:
 * the DOM is already correct, only the animation died.
 */
type Update = () => unknown;

interface ViewTransitionLike {
    finished: Promise<void>;
}

type StartViewTransition = (update: Update) => ViewTransitionLike;

function starter(): StartViewTransition | undefined {
    if (typeof globalThis.document === 'undefined') return undefined;
    const start = (globalThis.document as Document & { startViewTransition?: unknown }).startViewTransition;
    if (typeof start !== 'function') return undefined;
    return (start as StartViewTransition).bind(globalThis.document);
}

export function prefersReducedMotion(): boolean {
    return (
        typeof globalThis.matchMedia === 'function' && globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

export function transitionScreen(update: Update): void {
    const start = starter();
    if (!start || prefersReducedMotion()) {
        update();
        return;
    }
    try {
        start(update).finished.catch(() => {});
    } catch {
        update();
    }
}
