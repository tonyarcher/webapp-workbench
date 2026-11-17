import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { loadQueue, dequeue, clearQueue, speak, stopSpeaking, type ListenItem } from '../../services/listen-queue';
import styles from './listen-view.css?inline';

@customElement('listen-view')
export class ListenView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private queue: ListenItem[] = [];
    @state() private index = 0;
    @state() private playing = false;
    @state() private rate = 1.0;
    @state() private sleepMinutes = 0;
    private sleepTimer: number | null = null;

    override connectedCallback() {
        super.connectedCallback();
        this.queue = loadQueue();
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        stopSpeaking();
        if (this.sleepTimer !== null) window.clearTimeout(this.sleepTimer);
    }

    private current(): ListenItem | null {
        return this.queue[this.index] ?? null;
    }

    private play() {
        const item = this.current();
        if (!item) return;
        this.playing = true;
        speak(item.text, this.rate, () => {
            if (!this.playing) return;
            this.index += 1;
            if (this.index < this.queue.length) {
                this.play();
            } else {
                this.playing = false;
            }
        });
    }

    private pause() {
        this.playing = false;
        stopSpeaking();
    }

    private next() {
        this.pause();
        if (this.index + 1 < this.queue.length) {
            this.index += 1;
        }
    }

    private prev() {
        this.pause();
        if (this.index > 0) this.index -= 1;
    }

    private removeCurrent() {
        const item = this.current();
        if (!item) return;
        const next = dequeue(item.id);
        this.queue = next;
        if (this.index >= next.length) this.index = Math.max(0, next.length - 1);
    }

    private setSleep(mins: number) {
        this.sleepMinutes = mins;
        if (this.sleepTimer !== null) window.clearTimeout(this.sleepTimer);
        if (mins > 0) {
            this.sleepTimer = window.setTimeout(() => {
                this.pause();
                this.sleepTimer = null;
            }, mins * 60_000);
        }
    }

    override render() {
        const item = this.current();
        return html`
            <div class="view">
                <div class="toolbar"><h2>Listen queue</h2><span class="meta">${this.queue.length} item${this.queue.length === 1 ? '' : 's'}</span></div>
                <div class="body" tabindex="0">
                    ${this.queue.length === 0 ? html`<div class="empty">Queue is empty. Use “Listen” on an article to add it.</div>` : ''}
                    ${
                        item
                            ? html`
                        <div class="now">
                            <h3>${item.title}</h3>
                            <div class="controls">
                                <button class="btn" @click=${() => (this.playing ? this.pause() : this.play())}>${this.playing ? 'Pause' : 'Play'}</button>
                                <button class="btn" @click=${() => this.prev()}>Prev</button>
                                <button class="btn" @click=${() => this.next()}>Next</button>
                                <button class="btn danger" @click=${() => this.removeCurrent()}>Remove</button>
                            </div>
                            <div class="settings">
                                <label>Speed <input type="range" min="0.5" max="2" step="0.25" .value=${String(this.rate)} @input=${(
                                    e: Event,
                                ) => {
                                    this.rate = Number((e.target as HTMLInputElement).value);
                                }} /> ${this.rate.toFixed(2)}×</label>
                                <label>Sleep timer
                                    <select .value=${String(this.sleepMinutes)} @change=${(e: Event) => this.setSleep(Number((e.target as HTMLSelectElement).value))}>
                                        <option value="0">Off</option>
                                        <option value="15">15 min</option>
                                        <option value="30">30 min</option>
                                        <option value="45">45 min</option>
                                        <option value="60">60 min</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    `
                            : ''
                    }
                    <ul class="list">
                        ${this.queue.map(
                            (q, i) => html`
                            <li class="row ${i === this.index ? 'active' : ''}" @click=${() => {
                                this.pause();
                                this.index = i;
                            }}>
                                <span class="title">${q.title}</span>
                            </li>
                        `,
                        )}
                    </ul>
                    ${
                        this.queue.length
                            ? html`<button class="btn danger" @click=${() => {
                                  this.pause();
                                  this.queue = clearQueue();
                                  this.index = 0;
                              }}>Clear queue</button>`
                            : ''
                    }
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'listen-view': ListenView;
    }
}
