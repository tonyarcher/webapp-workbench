import { chunkWords, nextDelay } from '../../services/speed-read';
import styles from './speed-read-view.css?inline';

export class SpeedReadView extends HTMLElement {
    set text(value: string) {
        this._text = value;
        this.chunks = chunkWords(value, this.chunkSize);
        this.index = 0;
        this.paint();
    }
    get text(): string {
        return this._text;
    }
    private _text = '';
    private wpm = 300;
    private chunkSize = 1;
    private index = 0;
    private playing = false;
    private reducedMotion = false;
    private timer: number | null = null;
    private chunks: string[] = [];
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        this.text = this.getAttribute('text') ?? '';
        this.chunks = chunkWords(this.text, this.chunkSize);
        this.paint();
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
        this.paint();
    }

    private restart() {
        this.stop();
        this.index = 0;
        this.paint();
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Speed read';
        const playBtn = document.createElement('button');
        playBtn.className = 'btn';
        playBtn.textContent = this.playing ? 'Pause' : 'Play';
        playBtn.disabled = this.reducedMotion;
        playBtn.addEventListener('click', () => (this.playing ? this.stop() : this.start()));
        const restartBtn = document.createElement('button');
        restartBtn.className = 'btn';
        restartBtn.textContent = 'Restart';
        restartBtn.addEventListener('click', () => this.restart());
        const closeBtn = document.createElement('button');
        closeBtn.className = 'btn';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () =>
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true })),
        );
        toolbar.appendChild(h);
        toolbar.appendChild(playBtn);
        toolbar.appendChild(restartBtn);
        toolbar.appendChild(closeBtn);
        this.root.appendChild(toolbar);
        if (this.reducedMotion) {
            const reduced = document.createElement('div');
            reduced.className = 'reduced';
            reduced.textContent = 'Reduced motion is on — speed read is disabled. Reading the text below.';
            this.root.appendChild(reduced);
            const plain = document.createElement('div');
            plain.className = 'plain';
            plain.textContent = this.text;
            this.root.appendChild(plain);
        } else {
            const word = document.createElement('div');
            word.className = 'word';
            word.textContent = this.chunks[this.index] ?? '';
            this.root.appendChild(word);
            const progress = document.createElement('div');
            progress.className = 'progress';
            const span = document.createElement('span');
            span.style.width = `${this.chunks.length ? Math.round((this.index / this.chunks.length) * 100) : 0}%`;
            progress.appendChild(span);
            this.root.appendChild(progress);
            const controls = document.createElement('div');
            controls.className = 'controls';
            const wpmLabel = document.createElement('label');
            wpmLabel.textContent = 'WPM ';
            const wpmInput = document.createElement('input');
            wpmInput.type = 'range';
            wpmInput.min = '100';
            wpmInput.max = '600';
            wpmInput.step = '25';
            wpmInput.value = String(this.wpm);
            wpmInput.addEventListener('input', () => {
                this.wpm = Number(wpmInput.value);
            });
            wpmLabel.appendChild(wpmInput);
            controls.appendChild(wpmLabel);
            const chunkLabel = document.createElement('label');
            chunkLabel.textContent = 'Chunk ';
            const chunkInput = document.createElement('input');
            chunkInput.type = 'range';
            chunkInput.min = '1';
            chunkInput.max = '3';
            chunkInput.step = '1';
            chunkInput.value = String(this.chunkSize);
            chunkInput.addEventListener('input', () => {
                this.chunkSize = Number(chunkInput.value);
                this.chunks = chunkWords(this.text, this.chunkSize);
                this.index = 0;
                this.paint();
            });
            chunkLabel.appendChild(chunkInput);
            controls.appendChild(chunkLabel);
            this.root.appendChild(controls);
        }
    }

    disconnectedCallback() {
        this.stop();
    }
}

customElements.define('speed-read-view', SpeedReadView);
