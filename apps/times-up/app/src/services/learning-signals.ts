/**
 * Per-signal switches for the local Interesting model.
 *
 * The reader decides which behaviour the model may learn from. Like the
 * rest of the model these switches live in this browser only; nothing here
 * leaves the device. A missing or malformed entry reads as "on", so a new
 * signal starts enabled and an old profile keeps learning exactly as before.
 */

export type LearningSignal = 'star' | 'open' | 'dwell' | 'share' | 'summary' | 'original' | 'derank' | 'decay';

export interface LearningSignalSpec {
    kind: LearningSignal;
    label: string;
    detail: string;
}

/** Every signal the model can learn from, in dashboard order. */
export const LEARNING_SIGNALS: readonly LearningSignalSpec[] = [
    { kind: 'star', label: 'Stars', detail: 'Learn from stories you star, including likes from other devices.' },
    { kind: 'open', label: 'Time in an article', detail: 'Learn from how long you keep an article open.' },
    { kind: 'dwell', label: 'Headline dwell', detail: 'Learn from headlines you hover over in the list.' },
    { kind: 'share', label: 'Shares', detail: 'Learn from stories you share.' },
    { kind: 'summary', label: 'AI summaries', detail: 'Learn from stories you ask the reader to summarize.' },
    { kind: 'original', label: 'Visit original', detail: 'Learn from stories you open on the publisher site.' },
    { kind: 'derank', label: 'Not interesting', detail: 'Learn from stories you mark not interesting.' },
    { kind: 'decay', label: 'Daily decay', detail: 'Halve old weights once a day so recent reading leads.' },
];

const SIGNALS_KEY = 'times-up:learning-signals';

function defaultToggles(): Record<LearningSignal, boolean> {
    const out = {} as Record<LearningSignal, boolean>;
    for (const { kind } of LEARNING_SIGNALS) out[kind] = true;
    return out;
}

/** Stored switches with every signal present; anything unexpected is on. */
export function loadSignalToggles(): Record<LearningSignal, boolean> {
    const out = defaultToggles();
    try {
        const raw = localStorage.getItem(SIGNALS_KEY);
        if (!raw) return out;
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== 'object' || parsed === null) return out;
        for (const { kind } of LEARNING_SIGNALS) {
            if ((parsed as Record<string, unknown>)[kind] === false) out[kind] = false;
        }
    } catch {
        return out;
    }
    return out;
}

/** True unless the reader switched this signal off. */
export function isSignalEnabled(kind: LearningSignal): boolean {
    return loadSignalToggles()[kind] !== false;
}

export function setSignalEnabled(kind: LearningSignal, enabled: boolean): void {
    const toggles = loadSignalToggles();
    toggles[kind] = enabled;
    try {
        localStorage.setItem(SIGNALS_KEY, JSON.stringify(toggles));
    } catch {
        // storage unavailable; the switch just won't persist
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('interesting-settings-changed'));
}
