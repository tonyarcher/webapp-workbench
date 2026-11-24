export interface ListenItem {
    id: string;
    title: string;
    text: string;
}

const QUEUE_KEY = 'times-up:listen-queue';

export function loadQueue(): ListenItem[] {
    try {
        const raw = localStorage.getItem(QUEUE_KEY);
        return raw ? (JSON.parse(raw) as ListenItem[]) : [];
    } catch {
        return [];
    }
}

export function saveQueue(items: ListenItem[]): void {
    try {
        localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
    } catch {
        throw new Error('storage full');
    }
}

export function enqueue(item: ListenItem): ListenItem[] {
    const q = loadQueue();
    if (q.some((x) => x.id === item.id)) return q;
    const next = [...q, item];
    saveQueue(next);
    return next;
}

export function dequeue(id: string): ListenItem[] {
    const next = loadQueue().filter((x) => x.id !== id);
    saveQueue(next);
    return next;
}

export function clearQueue(): ListenItem[] {
    saveQueue([]);
    return [];
}

export function speak(text: string, rate: number, onEnd?: () => void): void {
    if (!('speechSynthesis' in window)) {
        onEnd?.();
        return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.rate = rate;
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}
