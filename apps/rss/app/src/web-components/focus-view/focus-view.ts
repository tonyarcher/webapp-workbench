import { startFocusSession } from '../../services/focus-session';
import type { FocusSessionState } from '../../services/focus-session';
import { fetchArticlesPage } from '../../services/api';
import styles from './focus-view.css?inline';

export class FocusView extends HTMLElement {
    private session: FocusSessionState | null = null;
    private duration = 15;
    private tick = 0;
    private timer: number | null = null;
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        this.paint();
    }

    disconnectedCallback() {
        if (this.timer !== null) window.clearInterval(this.timer);
    }

    private async start() {
        const page = await fetchArticlesPage({ scope: 'all', unreadOnly: true, sort: 'hot', limit: 10 });
        this.session = startFocusSession(page.items, this.duration * 60_000);
        this.timer = window.setInterval(() => {
            this.tick += 1;
            if (this.session && Date.now() >= this.session.endsAt) {
                this.finish();
            }
            this.paint();
        }, 1000);
        this.paint();
    }

    private finish() {
        if (this.timer !== null) window.clearInterval(this.timer);
        this.timer = null;
        if (this.session) this.session.status = 'done';
        this.paint();
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Focus session';
        toolbar.appendChild(h);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        const s = this.session;
        if (!s) {
            const picker = document.createElement('div');
            picker.className = 'picker';
            const label = document.createElement('label');
            label.textContent = 'Duration (min) ';
            const input = document.createElement('input');
            input.type = 'number';
            input.min = '5';
            input.max = '60';
            input.value = String(this.duration);
            input.addEventListener('input', (e) => {
                this.duration = Number((e.target as HTMLInputElement).value);
            });
            label.appendChild(input);
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = 'Start';
            btn.addEventListener('click', () => void this.start());
            picker.appendChild(label);
            picker.appendChild(btn);
            body.appendChild(picker);
        } else {
            const timer = document.createElement('div');
            timer.className = 'timer';
            timer.textContent = `${Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000))}s`;
            body.appendChild(timer);
            const queue = document.createElement('div');
            queue.className = 'queue';
            queue.textContent = `${s.queueIds.length} articles`;
            body.appendChild(queue);
            const btn = document.createElement('button');
            btn.className = 'btn';
            btn.textContent = 'Finish';
            btn.addEventListener('click', () => this.finish());
            body.appendChild(btn);
        }
        this.root.appendChild(body);
    }
}

customElements.define('focus-view', FocusView);
