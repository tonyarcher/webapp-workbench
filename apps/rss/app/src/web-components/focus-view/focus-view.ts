import {
    clearFocusSession,
    finishFocusSession,
    loadFocusSession,
    markFocusDone,
    recordKeptSession,
    remainingFocusIds,
    startFocusSession,
    takeFocusSeed,
    type FocusSessionState,
} from '../../services/focus-session';
import { fetchArticlesPage } from '../../services/api';
import { fetchSavedQueue } from '../../services/saved-queue';
import { markShownRead } from '../../mutations';
import { isSharedSnapshotId } from '../../services/shared-links';
import type { Article } from '../../types';
import styles from './focus-view.css?inline';

export class FocusView extends HTMLElement {
    private session: FocusSessionState | null = null;
    private queue: Article[] = [];
    private duration = 15;
    private loading = false;
    private marking = false;
    private keptRecorded = false;
    private generation = 0;
    private timer: number | null = null;
    private root: HTMLDivElement | null = null;

    connectedCallback(): void {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.append(style, this.root);
        const saved = loadFocusSession();
        if (saved) {
            this.session = saved;
            if (saved.status === 'running') this.startTimer();
            void this.restoreQueue();
        } else {
            const seed = takeFocusSeed();
            if (seed?.length) void this.start(seed);
            else this.paint();
        }
    }

    disconnectedCallback(): void {
        this.generation++;
        this.clearTimer();
    }

    private async start(seed: Article[] = []): Promise<void> {
        const gen = ++this.generation;
        this.loading = true;
        this.paint();
        try {
            const [saved, page] = await Promise.all([
                fetchSavedQueue(),
                fetchArticlesPage({ scope: 'all', unreadOnly: true, sort: 'hot', limit: 50 }),
            ]);
            if (gen !== this.generation || !this.isConnected) return;
            const combined = uniqueArticles([...seed, ...saved, ...page.items]);
            const priorityIds = [...saved, ...seed].map((article) => article.id);
            this.session = startFocusSession(combined, this.duration * 60_000, Date.now(), 10, priorityIds);
            this.queue = articlesFor(this.session, combined);
            this.startTimer();
        } catch {
            if (gen === this.generation && this.isConnected) this.session = null;
        } finally {
            if (gen === this.generation && this.isConnected) {
                this.loading = false;
                this.paint();
            }
        }
    }

    private async restoreQueue(): Promise<void> {
        const session = this.session;
        if (!session) return;
        const gen = ++this.generation;
        this.loading = true;
        this.paint();
        try {
            const [saved, page] = await Promise.all([
                fetchSavedQueue(),
                fetchArticlesPage({ scope: 'all', unreadOnly: true, sort: 'hot', limit: 100 }),
            ]);
            if (gen !== this.generation || !this.isConnected || this.session !== session) return;
            this.queue = articlesFor(session, uniqueArticles([...saved, ...page.items]));
        } catch {
            // IDs still render when article metadata is unavailable.
        } finally {
            if (gen === this.generation && this.isConnected) {
                this.loading = false;
                this.paint();
            }
        }
    }

    private startTimer(): void {
        this.clearTimer();
        if (!this.session || this.session.status !== 'running') return;
        this.timer = window.setInterval(() => {
            if (!this.isConnected || !this.session) return;
            const timer = this.root?.querySelector('.timer');
            if (timer) timer.textContent = `${Math.max(0, Math.ceil((this.session.endsAt - Date.now()) / 1000))}s`;
            if (Date.now() >= this.session.endsAt) this.finish();
        }, 1000);
    }

    private clearTimer(): void {
        if (this.timer !== null) window.clearInterval(this.timer);
        this.timer = null;
    }

    private recordKept(): void {
        if (this.keptRecorded) return;
        recordKeptSession();
        this.keptRecorded = true;
    }

    private finish(): void {
        if (!this.session || this.session.status === 'done') return;
        this.clearTimer();
        this.session = finishFocusSession(this.session);
        this.recordKept();
        this.paint();
    }

    private open(article: Article): void {
        if (!this.session) return;
        this.session = markFocusDone(this.session, article.id);
        if (this.session.status === 'done') {
            this.clearTimer();
            this.recordKept();
        }
        this.paint();
        const index = this.queue.findIndex((item) => item.id === article.id);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: { article, index, items: this.queue },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private keepUnread(): void {
        clearFocusSession();
        this.session = null;
        this.queue = [];
        this.keptRecorded = false;
        this.paint();
    }

    private async markRestRead(): Promise<void> {
        if (!this.session || this.marking) return;
        const session = this.session;
        const gen = this.generation;
        this.marking = true;
        this.paint();
        const ids = remainingFocusIds(session).filter((id) => !isSharedSnapshotId(id));
        const ok = ids.length === 0 || (await markShownRead(ids));
        if (!this.isConnected || gen !== this.generation || this.session !== session) return;
        this.marking = false;
        if (ok) this.keepUnread();
        else this.paint();
    }

    private nextSession(): void {
        clearFocusSession();
        this.session = null;
        this.queue = [];
        this.keptRecorded = false;
        this.marking = false;
        void this.start();
    }

    private paint(): void {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const heading = document.createElement('h2');
        heading.textContent = 'Focus session';
        toolbar.appendChild(heading);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        if (this.loading) body.appendChild(textNode('div', 'empty', 'Preparing your queue…'));
        else if (!this.session) this.paintPicker(body);
        else if (this.session.status === 'done') this.paintDone(body);
        else this.paintRunning(body);
        this.root.appendChild(body);
    }

    private paintPicker(body: HTMLElement): void {
        const picker = document.createElement('div');
        picker.className = 'picker';
        const label = document.createElement('label');
        label.textContent = 'Duration (min) ';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '5';
        input.max = '60';
        input.value = String(this.duration);
        input.addEventListener('input', () => {
            this.duration = Math.min(60, Math.max(5, Number(input.value) || 15));
        });
        label.appendChild(input);
        const start = textNode('button', 'btn primary', 'Start');
        start.addEventListener('click', () => void this.start());
        picker.append(label, start);
        body.appendChild(picker);
        body.appendChild(textNode('p', 'hint', 'Saved links and articles come first, then ranked unread stories.'));
    }

    private paintRunning(body: HTMLElement): void {
        const session = this.session;
        if (!session) return;
        const remaining = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
        body.appendChild(textNode('div', 'timer', `${remaining}s`));
        const progress = document.createElement('div');
        progress.className = 'progress';
        progress.setAttribute('role', 'progressbar');
        progress.setAttribute('aria-label', 'Focus session progress');
        progress.setAttribute('aria-valuemin', '0');
        progress.setAttribute('aria-valuemax', String(session.queueIds.length));
        progress.setAttribute('aria-valuenow', String(session.doneIds.length));
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.width = `${session.queueIds.length ? (session.doneIds.length / session.queueIds.length) * 100 : 0}%`;
        progress.appendChild(bar);
        body.appendChild(progress);
        const queue = document.createElement('div');
        queue.className = 'queue';
        for (const id of session.queueIds) {
            const article = this.queue.find((item) => item.id === id);
            const done = session.doneIds.includes(id);
            const row = document.createElement('div');
            row.className = `q-item${done ? ' done' : ''}`;
            row.appendChild(textNode('span', 'idx', String(session.queueIds.indexOf(id) + 1)));
            const content = document.createElement('div');
            content.className = 'q-body';
            const title = textNode('button', 'q-title', article?.title ?? id);
            title.addEventListener('click', () => {
                if (article) this.open(article);
            });
            content.appendChild(title);
            content.appendChild(textNode('div', 'q-meta', article?.link ?? 'Saved article'));
            row.appendChild(content);
            row.appendChild(textNode('span', 'q-state', done ? 'Done' : 'Unread'));
            queue.appendChild(row);
        }
        body.appendChild(queue);
        const actions = document.createElement('div');
        actions.className = 'actions';
        const finish = textNode('button', 'btn', 'Finish');
        finish.addEventListener('click', () => this.finish());
        actions.appendChild(finish);
        body.appendChild(actions);
    }

    private paintDone(body: HTMLElement): void {
        const session = this.session;
        if (!session) return;
        const card = document.createElement('div');
        card.className = 'card done-card';
        card.appendChild(textNode('h3', undefined, 'Session complete'));
        card.appendChild(
            textNode(
                'p',
                undefined,
                `You finished ${session.doneIds.length} of ${session.queueIds.length} articles. The rest stay unread unless you choose to mark them read.`,
            ),
        );
        const actions = document.createElement('div');
        actions.className = 'done-actions';
        const keep = textNode('button', 'btn', 'Keep remaining unread');
        keep.disabled = this.marking;
        keep.addEventListener('click', () => this.keepUnread());
        const mark = textNode('button', 'btn primary', 'Mark remaining read');
        mark.disabled = this.marking;
        mark.addEventListener('click', () => void this.markRestRead());
        const next = textNode('button', 'btn', 'Start next session');
        next.disabled = this.marking;
        next.addEventListener('click', () => this.nextSession());
        actions.append(keep, mark, next);
        card.appendChild(actions);
        body.appendChild(card);
    }
}

function uniqueArticles(articles: Article[]): Article[] {
    return [...new Map(articles.map((article) => [article.id, article])).values()];
}

function articlesFor(session: FocusSessionState, articles: Article[]): Article[] {
    const byId = new Map(articles.map((article) => [article.id, article]));
    return session.queueIds.flatMap((id) => {
        const article = byId.get(id);
        return article ? [article] : [];
    });
}

function textNode<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    className: string | undefined,
    text: string,
): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    return node;
}

customElements.define('focus-view', FocusView);
