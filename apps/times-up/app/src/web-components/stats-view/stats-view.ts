import { getAllArticles } from '../../db/db-query';
import { loadFocusStreak } from '../../services/focus-session';
import { downloadBlob } from '../../services/citation';
import { statsCsv, statsJson, summarizeStats } from '../../services/stats-export';
import { readMinutes } from '../../util';
import type { Article } from '../../types';
import styles from './stats-view.css?inline';

export class StatsView extends HTMLElement {
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

    private downloadStats(format: 'json' | 'csv'): void {
        const summary = summarizeStats(this.articles, loadFocusStreak().kept);
        const json = format === 'json';
        downloadBlob(
            new Blob([json ? statsJson(summary) : statsCsv(summary)], {
                type: json ? 'application/json' : 'text/csv',
            }),
            `times-up-stats.${format}`,
        );
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Mastery stats';
        toolbar.appendChild(h);
        if (!this.loading) {
            const actions = document.createElement('div');
            actions.className = 'toolbar-actions';
            for (const format of ['json', 'csv'] as const) {
                const button = document.createElement('button');
                button.className = 'btn';
                button.textContent = `Download ${format.toUpperCase()}`;
                button.addEventListener('click', () => this.downloadStats(format));
                actions.appendChild(button);
            }
            toolbar.appendChild(actions);
        }
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        body.setAttribute('data-setting', 'stats');
        if (this.loading) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'Loading…';
            body.appendChild(empty);
        } else {
            const grid = document.createElement('div');
            grid.className = 'grid';
            const streak = loadFocusStreak();
            const cards = [
                { label: 'Minutes read', value: String(this.totalMinutes) },
                { label: 'Finish rate', value: `${Math.round(this.finishRate * 100)}%` },
                { label: 'Articles read', value: `${this.readArticles.length} / ${this.articles.length}` },
                { label: 'Focus streak', value: String(streak.kept) },
            ];
            for (const c of cards) {
                const card = document.createElement('div');
                card.className = 'card';
                const label = document.createElement('span');
                label.className = 'label';
                label.textContent = c.label;
                const value = document.createElement('span');
                value.className = 'value';
                value.textContent = c.value;
                card.appendChild(label);
                card.appendChild(value);
                grid.appendChild(card);
            }
            body.appendChild(grid);
            const h3 = document.createElement('h3');
            h3.textContent = 'Topic mix';
            h3.tabIndex = -1;
            h3.setAttribute('data-setting', 'topic-mix');
            body.appendChild(h3);
            if (!this.topicMix.length) {
                const empty = document.createElement('div');
                empty.className = 'empty';
                empty.textContent = 'No read articles yet.';
                body.appendChild(empty);
            } else {
                const ul = document.createElement('ul');
                ul.className = 'topics';
                for (const t of this.topicMix) {
                    const li = document.createElement('li');
                    const topic = document.createElement('span');
                    topic.className = 'topic';
                    topic.textContent = t.topic;
                    const count = document.createElement('span');
                    count.className = 'count';
                    count.textContent = String(t.count);
                    li.appendChild(topic);
                    li.appendChild(count);
                    ul.appendChild(li);
                }
                body.appendChild(ul);
            }
        }
        this.root.appendChild(body);
    }
}

customElements.define('stats-view', StatsView);
