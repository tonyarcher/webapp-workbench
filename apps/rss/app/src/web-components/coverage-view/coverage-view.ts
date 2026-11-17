import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAllArticles } from '../../db/db-query';
import { domainOf } from '../../util';
import type { Article } from '../../types';
import styles from './coverage-view.css?inline';

interface TopicBreadth {
    topic: string;
    total: number;
    outlets: number;
    breadth: number;
    nudge: boolean;
}

@customElement('coverage-view')
export class CoverageView extends LitElement {
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

    private get breadth(): TopicBreadth[] {
        const map = new Map<string, { total: number; outlets: Set<string> }>();
        for (const a of this.readArticles) {
            const topic = a.scores?.topic ?? 'untagged';
            const outlet = domainOf(a.link) || 'unknown';
            const entry = map.get(topic) ?? { total: 0, outlets: new Set<string>() };
            entry.total += 1;
            entry.outlets.add(outlet);
            map.set(topic, entry);
        }
        return [...map.entries()]
            .map(([topic, e]) => {
                const outlets = e.outlets.size;
                const breadth = e.total ? outlets / e.total : 0;
                return { topic, total: e.total, outlets, breadth, nudge: outlets < 3 && e.total >= 3 };
            })
            .sort((a, b) => b.total - a.total);
    }

    override render() {
        return html`
            <div class="view">
                <div class="toolbar"><h2>Coverage balance</h2></div>
                <div class="body" tabindex="0">
                    ${this.loading ? html`<div class="empty">Loading…</div>` : ''}
                    ${!this.loading && !this.breadth.length ? html`<div class="empty">No read articles yet.</div>` : ''}
                    <ul class="list">
                        ${this.breadth.map(
                            (b) => html`
                            <li class="row">
                                <span class="topic">${b.topic}</span>
                                <span class="meta">${b.outlets} outlet${b.outlets === 1 ? '' : 's'} · ${b.total} article${b.total === 1 ? '' : 's'}</span>
                                <div class="bar"><span style="width: ${Math.round(b.breadth * 100)}%"></span></div>
                                ${b.nudge ? html`<span class="nudge">You have not heard the other side — broaden your sources.</span>` : ''}
                            </li>
                        `,
                        )}
                    </ul>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'coverage-view': CoverageView;
    }
}
