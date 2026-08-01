export function formatDate(ts: number): string {
    const d = new Date(ts);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ts >= startOfToday) {
        return d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
    }
    if (ts >= startOfToday - 86_400_000) return 'Yesterday';
    if (d.getFullYear() === now.getFullYear()) {
        return d.toLocaleDateString([], {month: 'short', day: 'numeric'});
    }
    return d.toLocaleDateString([], {month: 'short', day: 'numeric', year: 'numeric'});
}

export function domainOf(url: string | undefined): string {
    if (!url) return '';
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}
