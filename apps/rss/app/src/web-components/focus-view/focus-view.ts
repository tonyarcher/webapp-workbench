import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { fetchArticlesPage } from '../../services/api';
import { markShownRead } from '../../mutations';
import {
    clearFocusSession,
    finishFocusSession,
    loadFocusSession,
    loadFocusStreak,
    markFocusDone,
    recordKeptSession,
    remainingFocusIds,
    startFocusSession,
    type FocusSessionState,
    type FocusStreak,
} from '../../services/focus-session';
import type { Article } from '../../types';
import { domainOf, formatDate } from '../../util';
import styles from './focus-view.css?inline';

const DURATIONS = [5, 10, 15, 20, 30];
const QUEUE_LIMIT = 10;

function fmtRemaining(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

@customElement('focus-view')
export class FocusView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private session: FocusSessionState | null = loadFocusSession();
    @state() private streak: FocusStreak = loadFocusStreak();
    @state() private minutes = 15;
    @state() private articlesById = new Map<string, Article>();
    @state() private loading = false;
    @state() private loadError = '';
    @state() private now = Date.now();
    @state() private markingRest = false;
    private tickTimer: number | null = null;

    override connectedCallback() {
        super.connectedCallback();
        window.addEventListener('article-read', this.onArticleRead);
        if (this.session?.status === 'running') {
            void this.loadQueueArticles();
            this.startTick();
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('article-read', this.onArticleRead);
        this.stopTick();
    }

    private startTick() {
        this.stopTick();
        this.tickTimer = window.setInterval(() => {
            this.now = Date.now();
            const s = this.session;
            if (s && s.status === 'running' && this.now >= s.endsAt) {
                this.session = finishFocusSession(s);
                this.stopTick();
            }
        }, 1000);
    }

    private stopTick() {
        if (this.tickTimer !== null) clearInterval(this.tickTimer);
        this.tickTimer = null;
    }

    private onArticleRead = (e: Event) => {
        const detail = (e as CustomEvent<string | { id: string; read: 0 | 1 }>).detail;
        const id = typeof detail === 'string' ? detail : detail.id;
        const read = typeof detail === 'string' ? 1 : detail.read;
        if (read !== 1) return;
        const s = this.session;
        if (!s || s.status !== 'running') return;
        if (!s.queueIds.includes(id) || s.doneIds.includes(id)) return;
        this.session = markFocusDone(s, id);
        const art = this.articlesById.get(id);
        if (art) this.articlesById = new Map(this.articlesById).set(id, { ...art, read: 1 });
    };

    private async loadQueueArticles() {
        const s = this.session;
        if (!s) return;
        this.loading = true;
        this.loadError = '';
        try {
            // Fetch a generous unread pool and resolve the queued ids from it.
            const res = await fetchArticlesPage({ unreadOnly: false, sort: 'newest', limit: 500 });
            const map = new Map(res.items.map((a) => [a.id, a]));
            this.articlesById = map;
        } catch {
            this.loadError = 'Could not load session articles.';
        } finally {
            this.loading = false;
        }
    }

    private async onStart() {
        this.loading = true;
        this.loadError = '';
        try {
            const res = await fetchArticlesPage({ unreadOnly: true, sort: 'hot', limit: 300 });
            if (!this.isConnected) return;
            if (!res.items.length) {
                this.loadError = 'Nothing unread to focus on right now.';
                return;
            }
            this.articlesById = new Map(res.items.map((a) => [a.id, a]));
            this.session = startFocusSession(res.items, this.minutes * 60_000, Date.now(), QUEUE_LIMIT);
            this.now = Date.now();
            if (this.session.queueIds.length === 0) {
                this.loadError = 'Nothing unread to focus on right now.';
                this.session = null;
                clearFocusSession();
                return;
            }
            this.startTick();
        } catch {
            if (this.isConnected) this.loadError = 'Could not start a focus session.';
        } finally {
            if (this.isConnected) this.loading = false;
        }
    }

    private onFinishEarly() {
        if (!this.session) return;
        this.session = finishFocusSession(this.session);
        this.stopTick();
    }

    private onKeepUnread() {
        // End without marking the rest read; count as kept (user chose a bottom).
        if (this.session) this.streak = recordKeptSession();
        this.session = null;
        clearFocusSession();
        this.stopTick();
    }

    private async onMarkRestRead() {
        const s = this.session;
        if (!s || this.markingRest) return;
        const remaining = remainingFocusIds(s).filter((id) => {
            const a = this.articlesById.get(id);
            return !a || a.read === 0;
        });
        this.markingRest = true;
        try {
            if (remaining.length) {
                const ok = await markShownRead(remaining);
                if (!ok) return;
            }
            this.streak = recordKeptSession();
            this.session = null;
            clearFocusSession();
            this.stopTick();
        } finally {
            if (this.isConnected) this.markingRest = false;
        }
    }

    private onAbandon() {
        this.session = null;
        clearFocusSession();
        this.stopTick();
    }

    private openArticle(article: Article) {
        const s = this.session;
        if (!s) return;
        const items = s.queueIds.map((id) => this.articlesById.get(id)).filter((a): a is Article => !!a);
        const index = items.findIndex((a) => a.id === article.id);
        this.dispatchEvent(
            new CustomEvent('open-article', {
                detail: { article, index: index < 0 ? 0 : index, items: items.length ? items : [article] },
                bubbles: true,
                composed: true,
            }),
        );
    }

    override render() {
        const s = this.session;
        if (!s) return this.renderStart();
        if (s.status === 'done') return this.renderDone(s);
        return this.renderRunning(s);
    }

    private renderStart() {
        return html`
      <div class="focus">
        <header class="focus-head">
          <h2>Focus session</h2>
          <p class="sub">A short, ranked queue with a bottom. Read what matters, then stop.</p>
        </header>
        <div class="card">
          <label class="field">Duration
            <select .value=${String(this.minutes)} @change=${(e: Event) => (this.minutes = Number((e.target as HTMLSelectElement).value))}>
              ${DURATIONS.map((m) => html`<option value=${m}>${m} minutes</option>`)}
            </select>
          </label>
          <p class="hint">Queues up to ${QUEUE_LIMIT} unread articles, ranked for you.</p>
          <button class="primary" ?disabled=${this.loading} @click=${this.onStart}>${this.loading ? 'Starting…' : 'Start session'}</button>
          ${this.loadError ? html`<p class="error">${this.loadError}</p>` : ''}
        </div>
        <p class="streak">Sessions kept: ${this.streak.kept}${this.streak.lastKeptDate ? html` <span class="muted">(last ${this.streak.lastKeptDate})</span>` : ''}</p>
      </div>`;
    }

    private renderRunning(s: FocusSessionState) {
        const remainingMs = Math.max(0, s.endsAt - this.now);
        const doneCount = s.doneIds.length;
        const total = s.queueIds.length || 1;
        const pct = Math.min(100, Math.round((doneCount / total) * 100));
        return html`
      <div class="focus">
        <header class="focus-head row">
          <div>
            <h2>Focus session</h2>
            <p class="sub">${doneCount} of ${s.queueIds.length} read · ${fmtRemaining(remainingMs)} left</p>
          </div>
          <div class="actions">
            <button class="btn" @click=${this.onFinishEarly}>Finish session</button>
            <button class="btn" @click=${this.onAbandon}>Abandon</button>
          </div>
        </header>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax=${s.queueIds.length} aria-valuenow=${doneCount} aria-label="Session progress">
          <div class="bar" style="width:${pct}%"></div>
        </div>
        ${this.loading ? html`<p class="muted">Loading queue…</p>` : ''}
        ${this.loadError ? html`<p class="error">${this.loadError}</p>` : ''}
        <ol class="queue">${s.queueIds.map((id, i) => this.renderQueueItem(s, id, i))}</ol>
      </div>`;
    }

    private renderQueueItem(s: FocusSessionState, id: string, i: number) {
        const article = this.articlesById.get(id);
        const done = s.doneIds.includes(id) || article?.read === 1;
        return html`
      <li class="q-item ${done ? 'done' : ''}">
        <span class="idx" aria-hidden="true">${i + 1}</span>
        <div class="q-body">
          ${
              article
                  ? html`<button class="q-title" @click=${() => this.openArticle(article)}>${article.title}</button>
                <span class="q-meta">${domainOf(article.link)}${article.published ? html` · ${formatDate(article.published)}` : ''}</span>`
                  : html`<span class="q-title muted">Article unavailable</span>`
          }
        </div>
        <span class="q-state">${done ? 'Read' : 'Unread'}</span>
      </li>`;
    }

    private renderDone(s: FocusSessionState) {
        const remaining = remainingFocusIds(s).filter((id) => {
            const a = this.articlesById.get(id);
            return !a || a.read === 0;
        });
        const allDone = remaining.length === 0;
        return html`
      <div class="focus">
        <header class="focus-head">
          <h2>${allDone ? 'Session complete' : 'Session finished'}</h2>
          <p class="sub">${s.doneIds.length} of ${s.queueIds.length} read.${allDone ? ' Nice work.' : ' You set a bottom — that counts.'}</p>
        </header>
        <div class="card done-card">
          ${
              allDone
                  ? html`<p>Queue cleared.</p><button class="primary" @click=${() => {
                        this.streak = recordKeptSession();
                        this.session = null;
                        clearFocusSession();
                        this.stopTick();
                    }}>Close</button>`
                  : html`<p>${remaining.length} unread item${remaining.length === 1 ? '' : 's'} left in this session.</p>
                <div class="done-actions">
                  <button class="primary" ?disabled=${this.markingRest} @click=${this.onMarkRestRead}>${this.markingRest ? 'Marking…' : 'Mark rest as read'}</button>
                  <button class="btn" @click=${this.onKeepUnread}>Keep unread</button>
                </div>
                <p class="hint">Marking the rest read happens only if you approve it.</p>`
          }
        </div>
        <p class="streak">Sessions kept: ${this.streak.kept}</p>
      </div>`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'focus-view': FocusView;
    }
}
