import { LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { chunkWords, nextDelay } from '../../services/speed-read';
import { renderSpeedRead } from './speed-read-view-render';
import styles from './speed-read-view.css?inline';

@customElement('speed-read-view')
export class SpeedReadView extends LitElement {
    static override styles = unsafeCSS(styles);

    @property() text = '';
    @state() private wpm = 300;
    @state() private chunkSize = 1;
    @state() private index = 0;
    @state() private playing = false;
    @state() private reducedMotion = false;
    private timer: number | null = null;
    private chunks: string[] = [];

    override connectedCallback() {
        super.connectedCallback();
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.chunks = chunkWords(this.text, this.chunkSize);
    }

    override updated(changed: Map<string, unknown>) {
        if (changed.has('text') || changed.has('chunkSize')) {
            this.chunks = chunkWords(this.text, this.chunkSize);
            this.index = 0;
            this.stop();
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        this.stop();
    }

    private start() {
        if (this.reducedMotion) return;
        this.playing = true;
        this.tick();
    }

    private stop() {
        this.playing = false;
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
    }

    private tick() {
        if (!this.playing || this.index >= this.chunks.length) {
            this.stop();
            return;
        }
        const chunk = this.chunks[this.index] ?? '';
        const delay = nextDelay(this.wpm, this.chunkSize, chunk);
        this.timer = window.setTimeout(() => {
            this.index += 1;
            this.tick();
        }, delay);
    }

    override render() {
        return renderSpeedRead({
            text: this.text,
            wpm: this.wpm,
            chunkSize: this.chunkSize,
            index: this.index,
            chunks: this.chunks,
            playing: this.playing,
            reducedMotion: this.reducedMotion,
            toggle: () => (this.playing ? this.stop() : this.start()),
            restart: () => {
                this.stop();
                this.index = 0;
            },
            close: () => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
            setWpm: (v) => (this.wpm = v),
            setChunkSize: (v) => (this.chunkSize = v),
        });
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'speed-read-view': SpeedReadView;
    }
}
