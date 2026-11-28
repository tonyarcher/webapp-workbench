// C3 focus mode. The article panel owns the scroll listener and the active
// block class; disabling or disconnecting removes both.

const FOCUS_CLASS = 'focus-mode';
const ACTIVE_CLASS = 'focus-active';

export class ArticleFocus {
    private active: HTMLElement | null = null;
    private frame: number | null = null;
    private readonly host: HTMLElement;

    constructor(host: HTMLElement) {
        this.host = host;
    }

    get enabled(): boolean {
        return this.host.classList.contains(FOCUS_CLASS);
    }

    toggle(): void {
        if (this.enabled) this.disable();
        else this.enable();
    }

    enable(): void {
        this.host.classList.add(FOCUS_CLASS);
        this.host.addEventListener('scroll', this.onScroll);
        this.schedule();
    }

    disable(): void {
        this.host.classList.remove(FOCUS_CLASS);
        this.host.removeEventListener('scroll', this.onScroll);
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.active?.classList.remove(ACTIVE_CLASS);
        this.active = null;
    }

    reset(): void {
        this.disable();
    }

    private onScroll = (): void => {
        this.schedule();
    };

    private schedule(): void {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(() => {
            this.frame = null;
            this.update();
        });
    }

    private update(): void {
        const root = this.host.shadowRoot ?? this.host;
        const blocks = [...root.querySelectorAll<HTMLElement>('.content > *')];
        const first = blocks[0];
        if (!first) return;
        const top = this.host.getBoundingClientRect().top;
        const readingLine = top + Math.min(180, this.host.clientHeight * 0.3);
        let best = first;
        let distance = Number.POSITIVE_INFINITY;
        for (const block of blocks) {
            const rect = block.getBoundingClientRect();
            const candidate = Math.abs(rect.top - readingLine);
            if (candidate < distance) {
                distance = candidate;
                best = block;
            }
        }
        if (best === this.active) return;
        this.active?.classList.remove(ACTIVE_CLASS);
        best.classList.add(ACTIVE_CLASS);
        this.active = best;
    }
}
