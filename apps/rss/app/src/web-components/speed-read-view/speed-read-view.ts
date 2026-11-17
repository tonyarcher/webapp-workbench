import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { chunkWords, nextDelay } from '../../services/speed-read';
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
        this.index += 1;
        const delay = nextDelay(this.wpm, this.chunkSize, chunk);
        this.timer = window.setTimeout(() => this.tick(), delay);
    }

    private restart() {
        this.stop();
        this.index = 0;
    }

    override render() {
        const chunk = this.chunks[this.index] ?? '';
        const progress = this.chunks.length ? Math.round((this.index / this.chunks.length) * 100) : 0;
        return html`
            <div class="view">
                <div class="toolbar">
                    <h2>Speed read</h2>
                    <button class="btn" @click=${() => (this.playing ? this.stop() : this.start())} ?disabled=${this.reducedMotion}>${this.playing ? 'Pause' : 'Play'}</button>
                    <button class="btn" @click=${() => this.restart()}>Restart</button>
                    <button class="btn" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>Close</button>
                </div>
                ${
                    this.reducedMotion
                        ? html`<div class="reduced">Reduced motion is on — speed read is disabled. Reading the text below.</div><div class="plain">${this.text}</div>`
                        : html`
                    <div class="word">${chunk}</div>
                    <div class="progress"><span style="width: ${progress}%"></span></div>
                    <div class="controls">
                        <label>WPM <input type="range" min="100" max="600" step="25" .value=${String(this.wpm)} @input=${(
                            e: Event,
                        ) => {
                            this.wpm = Number((e.target as HTMLInputElement).value);
                        }} /></label>
                        <label>Chunk <input type="range" min="1" max="3" step="1" .value=${String(this.chunkSize)} @input=${(
                            e: Event,
                        ) => {
                            this.chunkSize = Number((e.target as HTMLInputElement).value);
                        }} /></label>
                    </div>
                `
                }
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'speed-read-view': SpeedReadView;
    }
}
