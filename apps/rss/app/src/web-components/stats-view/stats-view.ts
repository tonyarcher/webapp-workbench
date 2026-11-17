import { LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAllArticles } from '../../db/db-query';
import { loadFocusStreak } from '../../services/focus-session';
import { readMinutes } from '../../util';
import type { Article } from '../../types';
import { renderStatsView } from './stats-view-render';
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
        return renderStatsView({
            loading: this.loading,
            totalMinutes: this.totalMinutes,
            finishRate: this.finishRate,
            readCount: this.readArticles.length,
            totalCount: this.articles.length,
            streak: loadFocusStreak().kept,
            topics: this.topicMix,
        });
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'stats-view': StatsView;
    }
}
