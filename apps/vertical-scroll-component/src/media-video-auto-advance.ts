import { isTiktokPhotoUrl } from './media';
import { embedProviderForUrl, embedUrlFor } from './embeds';

type Host = {
    autoAdvance: boolean;
    active: boolean;
    isConnected: boolean;
    playing: boolean;
    resolveFailed: boolean;
    naturalEnded: boolean;
    sawPlaybackProgress: boolean;
    embedSource(): string | null;
    embedOptions(): { loop: boolean };
    item: { originalUrl?: string | null; url?: string | null } | undefined;
    dispatchEvent(event: Event): boolean;
};

export class VideoAutoAdvance {
    private photoTimer: ReturnType<typeof setTimeout> | null = null;
    private unavailableTimer: ReturnType<typeof setTimeout> | null = null;
    static readonly PHOTO_MS = 30_000;
    static readonly UNAVAILABLE_MS = 15_000;
    private readonly host: Host;

    constructor(host: Host) {
        this.host = host;
    }

    reset(): void {
        this.clearPhoto();
        this.clearUnavailable();
    }

    clearAll(): void {
        this.reset();
    }

    isPhotoPost(): boolean {
        const h = this.host;
        return (
            isTiktokPhotoUrl(h.embedSource()) ||
            isTiktokPhotoUrl(h.item?.originalUrl ?? null) ||
            isTiktokPhotoUrl(h.item?.url ?? null)
        );
    }

    private clearPhoto(): void {
        if (this.photoTimer !== null) {
            clearTimeout(this.photoTimer);
            this.photoTimer = null;
        }
    }

    private clearUnavailable(): void {
        if (this.unavailableTimer !== null) {
            clearTimeout(this.unavailableTimer);
            this.unavailableTimer = null;
        }
    }

    clearUnavailableTimer(): void {
        this.clearUnavailable();
    }

    emitEnded(): void {
        const h = this.host;
        if (!h.active || !h.isConnected || h.naturalEnded) return;
        h.naturalEnded = true;
        this.reset();
        h.dispatchEvent(new CustomEvent('playback-ended', { bubbles: true, composed: true }));
    }

    syncPhoto(): void {
        const h = this.host;
        if (h.autoAdvance && h.active && h.isConnected && !h.naturalEnded && this.isPhotoPost()) {
            if (!h.playing) {
                this.clearPhoto();
                return;
            }
            if (this.photoTimer === null) {
                this.photoTimer = setTimeout(() => {
                    this.photoTimer = null;
                    if (h.autoAdvance && h.active && h.isConnected && !h.naturalEnded && h.playing) this.emitEnded();
                }, VideoAutoAdvance.PHOTO_MS);
            }
            return;
        }
        this.clearPhoto();
    }

    syncUnavailable(): void {
        const h = this.host;
        const embedUrl = embedUrlFor(h.embedSource(), h.embedOptions());
        const provider = embedProviderForUrl(h.embedSource());
        const isNativeUnavailable = h.resolveFailed && !embedUrl;
        const canDetectProgress = !!provider?.parsePlayerMessage;
        const isStalledEmbed = !!embedUrl && canDetectProgress && !h.sawPlaybackProgress;
        const isNonPlayback = isNativeUnavailable || isStalledEmbed;
        if (h.autoAdvance && h.active && h.isConnected && !h.naturalEnded && isNonPlayback) {
            if (this.unavailableTimer === null) {
                this.unavailableTimer = setTimeout(() => {
                    this.unavailableTimer = null;
                    const currentEmbedUrl = embedUrlFor(h.embedSource(), h.embedOptions());
                    const currentProvider = embedProviderForUrl(h.embedSource());
                    const stillNonPlayback =
                        (h.resolveFailed && !currentEmbedUrl) ||
                        (!!currentEmbedUrl && !!currentProvider?.parsePlayerMessage && !h.sawPlaybackProgress);
                    if (h.autoAdvance && h.active && h.isConnected && !h.naturalEnded && stillNonPlayback) {
                        this.emitEnded();
                    }
                }, VideoAutoAdvance.UNAVAILABLE_MS);
            }
            return;
        }
        this.clearUnavailable();
    }
}
