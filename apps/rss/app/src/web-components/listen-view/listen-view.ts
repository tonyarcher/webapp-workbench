import { loadQueue, dequeue, clearQueue, speak, stopSpeaking, type ListenItem } from '../../services/listen-queue';
import styles from './listen-view.css?inline';

export class ListenView extends HTMLElement {
    private queue: ListenItem[] = [];
    private index = 0;
    private playing = false;
    private rate = 1.0;
    private sleepMinutes = 0;
    private sleepTimer: number | null = null;
    private autoPlayTimer: number | null = null;
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        this.queue = loadQueue();
        if (this.queue.length) {
            this.autoPlayTimer = window.setTimeout(() => this.play(), 100);
        }
        this.paint();
    }

    disconnectedCallback() {
        this.stop();
        if (this.sleepTimer !== null) window.clearTimeout(this.sleepTimer);
        if (this.autoPlayTimer !== null) window.clearTimeout(this.autoPlayTimer);
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
            if (this.index < this.queue.length) this.play();
            else this.playing = false;
            this.paint();
        });
        this.paint();
    }

    private stop() {
        this.playing = false;
        stopSpeaking();
        if (this.sleepTimer !== null) window.clearTimeout(this.sleepTimer);
        if (this.autoPlayTimer !== null) window.clearTimeout(this.autoPlayTimer);
    }

    private pause() {
        this.stop();
        this.paint();
    }

    private next() {
        this.pause();
        if (this.index + 1 < this.queue.length) this.index += 1;
        this.paint();
    }
    private prev() {
        this.pause();
        if (this.index > 0) this.index -= 1;
        this.paint();
    }

    private removeCurrent() {
        const item = this.current();
        if (!item) return;
        const next = dequeue(item.id);
        this.queue = next;
        if (this.index >= next.length) this.index = Math.max(0, next.length - 1);
        this.paint();
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

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Listen queue';
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = `${this.queue.length} item${this.queue.length === 1 ? '' : 's'}`;
        toolbar.appendChild(h);
        toolbar.appendChild(meta);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        if (this.queue.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Queue is empty. Use “Listen” on an article to add it.';
            body.appendChild(empty);
        } else {
            const item = this.current();
            if (item) {
                const now = document.createElement('div');
                now.className = 'now';
                const title = document.createElement('h3');
                title.textContent = item.title;
                now.appendChild(title);
                const controls = document.createElement('div');
                controls.className = 'controls';
                const playBtn = document.createElement('button');
                playBtn.className = 'btn';
                playBtn.textContent = this.playing ? 'Pause' : 'Play';
                playBtn.addEventListener('click', () => (this.playing ? this.pause() : this.play()));
                const prevBtn = document.createElement('button');
                prevBtn.className = 'btn';
                prevBtn.textContent = 'Prev';
                prevBtn.addEventListener('click', () => this.prev());
                const nextBtn = document.createElement('button');
                nextBtn.className = 'btn';
                nextBtn.textContent = 'Next';
                nextBtn.addEventListener('click', () => this.next());
                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn danger';
                removeBtn.textContent = 'Remove';
                removeBtn.addEventListener('click', () => this.removeCurrent());
                controls.appendChild(playBtn);
                controls.appendChild(prevBtn);
                controls.appendChild(nextBtn);
                controls.appendChild(removeBtn);
                now.appendChild(controls);
                const settings = document.createElement('div');
                settings.className = 'settings';
                const speedLabel = document.createElement('label');
                speedLabel.textContent = 'Speed ';
                const speedInput = document.createElement('input');
                speedInput.type = 'range';
                speedInput.min = '0.5';
                speedInput.max = '2';
                speedInput.step = '0.25';
                speedInput.value = String(this.rate);
                speedInput.addEventListener('input', () => {
                    this.rate = Number(speedInput.value);
                });
                speedLabel.appendChild(speedInput);
                const rateSpan = document.createElement('span');
                rateSpan.textContent = ` ${this.rate.toFixed(2)}×`;
                speedLabel.appendChild(rateSpan);
                settings.appendChild(speedLabel);
                const sleepLabel = document.createElement('label');
                sleepLabel.textContent = 'Sleep timer ';
                const sleepSelect = document.createElement('select');
                sleepSelect.value = String(this.sleepMinutes);
                for (const [v, l] of [
                    ['0', 'Off'],
                    ['15', '15 min'],
                    ['30', '30 min'],
                    ['45', '45 min'],
                    ['60', '60 min'],
                ]) {
                    const opt = document.createElement('option');
                    opt.value = v ?? '';
                    opt.textContent = l ?? '';
                    sleepSelect.appendChild(opt);
                }
                sleepSelect.addEventListener('change', () => this.setSleep(Number(sleepSelect.value)));
                sleepLabel.appendChild(sleepSelect);
                settings.appendChild(sleepLabel);
                now.appendChild(settings);
                body.appendChild(now);
            }
            const ul = document.createElement('ul');
            ul.className = 'list';
            this.queue.forEach((q, i) => {
                const li = document.createElement('li');
                li.className = `row ${i === this.index ? 'active' : ''}`;
                li.addEventListener('click', () => {
                    this.pause();
                    this.index = i;
                    this.paint();
                });
                const span = document.createElement('span');
                span.className = 'title';
                span.textContent = q.title;
                li.appendChild(span);
                ul.appendChild(li);
            });
            body.appendChild(ul);
            const clearBtn = document.createElement('button');
            clearBtn.className = 'btn danger';
            clearBtn.textContent = 'Clear queue';
            clearBtn.addEventListener('click', () => {
                this.pause();
                this.queue = clearQueue();
                this.index = 0;
                this.paint();
            });
            body.appendChild(clearBtn);
        }
        this.root.appendChild(body);
    }
}

customElements.define('listen-view', ListenView);
