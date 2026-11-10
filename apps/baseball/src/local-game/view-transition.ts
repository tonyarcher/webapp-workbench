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
 * The after callback routes focus to the new screen once it is showing:
 * view transitions morph layout but never move focus, so without it keyboard
 * and screen-reader users are stranded where the old screen was.
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

export function transitionScreen(update: Update, after?: () => void): void {
    const start = starter();
    if (!start || prefersReducedMotion()) {
        // Lit renders async: route focus after the update settles, or after
        // would find (and focus) the outgoing screen's heading. update() may
        // also throw synchronously, in which case there is nothing to wait
        // for and focus is best-effort on whatever is showing.
        try {
            void Promise.resolve(update()).then(() => after?.());
        } catch {
            after?.();
        }
        return;
    }
    try {
        // then(after, after): focus routing runs whether the transition
        // finished or was aborted — either way the DOM shows the new screen.
        // The trailing catch swallows the derived rejection when there is no
        // after callback (or it throws): the DOM is already correct.
        start(update)
            .finished.then(after, after)
            .catch(() => {});
    } catch {
        update();
        after?.();
    }
}
