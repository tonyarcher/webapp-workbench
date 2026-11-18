import type { Article } from '../../types';
import styles from './coverage-view.css?inline';

export class CoverageView extends HTMLElement {
    private articles: Article[] = [];
    private loading = true;
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        void this.load();
    }

    private async load() {
        this.loading = true;
        this.paint();
        try {
            const { getAllArticles } = await import('../../db/db-query');
            this.articles = await getAllArticles();
        } catch {
            this.articles = [];
        }
        this.loading = false;
        this.paint();
    }

    private get readArticles() {
        return this.articles.filter((a) => a.read === 1);
    }

    private breadth(): Array<{ topic: string; total: number; outlets: number; breadth: number; nudge: boolean }> {
        const map = new Map<string, { total: number; outlets: Set<string> }>();
        for (const a of this.readArticles) {
            const topic = a.scores?.topic ?? 'untagged';
            const outlet = a.link ? new URL(a.link).hostname : 'unknown';
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

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Coverage balance';
        toolbar.appendChild(h);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        if (this.loading) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Loading…';
            body.appendChild(empty);
        } else if (!this.breadth().length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No read articles yet.';
            body.appendChild(empty);
        } else {
            const ul = document.createElement('ul');
            ul.className = 'list';
            for (const b of this.breadth()) {
                const li = document.createElement('li');
                li.className = 'row';
                const topic = document.createElement('span');
                topic.className = 'topic';
                topic.textContent = b.topic;
                li.appendChild(topic);
                const meta = document.createElement('span');
                meta.className = 'meta';
                meta.textContent = `${b.outlets} outlet${b.outlets === 1 ? '' : 's'} · ${b.total} article${b.total === 1 ? '' : 's'}`;
                li.appendChild(meta);
                const bar = document.createElement('div');
                bar.className = 'bar';
                const span = document.createElement('span');
                span.style.width = `${Math.round(b.breadth * 100)}%`;
                bar.appendChild(span);
                li.appendChild(bar);
                if (b.nudge) {
                    const nudge = document.createElement('span');
                    nudge.className = 'nudge';
                    nudge.textContent = 'You have not heard the other side — broaden your sources.';
                    li.appendChild(nudge);
                }
                ul.appendChild(li);
            }
            body.appendChild(ul);
        }
        this.root.appendChild(body);
    }
}

customElements.define('coverage-view', CoverageView);
