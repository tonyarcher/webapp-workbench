import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAllArticles } from '../../db/db-query';
import { loadFocusStreak } from '../../services/focus-session';
import { readMinutes } from '../../util';
import type { Article } from '../../types';
import styles from './stats-view.css?inline';

@customElement('stats-view')
export class StatsView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private articles: Article[] = [];
    @state() private loading = true;

    override connectedCallback() {
        super.connectedCallback();
        void this.load();
    }

    private async load() {
        this.loading = true;
        try {
            this.articles = await getAllArticles();
        } catch {
            this.articles = [];
        }
        this.loading = false;
    }

    private get readArticles() {
        return this.articles.filter((a) => a.read === 1);
    }
    private get totalMinutes() {
        return this.readArticles.reduce((s, a) => s + readMinutes(a.content, a.summary), 0);
    }
    private get finishRate() {
        return this.articles.length ? this.readArticles.length / this.articles.length : 0;
    }
    private get topicMix(): Array<{ topic: string; count: number }> {
        const map = new Map<string, number>();
        for (const a of this.readArticles) {
            const t = a.scores?.topic ?? 'untagged';
            map.set(t, (map.get(t) ?? 0) + 1);
        }
        return [...map.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
    }

    override render() {
        const streak = loadFocusStreak();
        return html`
            <div class="view">
                <div class="toolbar"><h2>Mastery stats</h2></div>
                <div class="body" tabindex="0">
                    ${this.loading ? html`<div class="empty">Loading…</div>` : ''}
                    ${
                        !this.loading
                            ? html`
                        <div class="grid">
                            <div class="card"><span class="label">Minutes read</span><span class="value">${this.totalMinutes}</span></div>
                            <div class="card"><span class="label">Finish rate</span><span class="value">${Math.round(this.finishRate * 100)}%</span></div>
                            <div class="card"><span class="label">Articles read</span><span class="value">${this.readArticles.length} / ${this.articles.length}</span></div>
                            <div class="card"><span class="label">Focus streak</span><span class="value">${streak.kept}</span></div>
                        </div>
                        <h3>Topic mix</h3>
                        <ul class="topics">
                            ${this.topicMix.map((t) => html`<li><span class="topic">${t.topic}</span><span class="count">${t.count}</span></li>`)}
                        </ul>
                        ${!this.topicMix.length ? html`<div class="empty">No read articles yet.</div>` : ''}
                    `
                            : ''
                    }
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'stats-view': StatsView;
    }
}
