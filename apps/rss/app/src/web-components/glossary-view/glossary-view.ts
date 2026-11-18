import { getAllArticles } from '../../db/db-query';
import { extractTerms, termContext } from '../../services/glossary';

/**
 * Spike: the glossary view as a vanilla custom element. No Lit, no `html`
 * tagged templates anywhere in this file — DOM is built with
 * document.createElement / textContent / addEventListener only.
 * Not wired into the app; the Lit <glossary-view> stays live.
 */
export class GlossaryView extends HTMLElement {
    private filter = '';
    private terms: Array<{ term: string; count: number; context: string }> = [];
    private loading = true;
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        this.root = document.createElement('div');
        this.root.className = 'view';
        this.appendChild(this.root);
        void this.load();
    }

    private async load() {
        this.loading = true;
        this.paint();
        try {
            const articles = await getAllArticles();
            const read = articles.filter((a) => a.read === 1);
            const counts = new Map<string, number>();
            for (const a of read) {
                for (const t of extractTerms(a.content ?? a.summary ?? '')) {
                    counts.set(t, (counts.get(t) ?? 0) + 1);
                }
            }
            this.terms = [...counts.entries()]
                .map(([term, count]) => ({ term, count, context: termContext(read, term) }))
                .sort((a, b) => b.count - a.count);
        } catch {
            this.terms = [];
        }
        this.loading = false;
        this.paint();
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        this.root.appendChild(this.toolbar());
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        body.appendChild(this.filterInput());
        if (this.loading) {
            body.appendChild(this.empty('Loading…'));
        } else if (this.filtered().length === 0) {
            body.appendChild(this.empty('No terms yet. Read some articles first.'));
        } else {
            const list = document.createElement('ul');
            list.className = 'list';
            for (const t of this.filtered()) list.appendChild(this.row(t));
            body.appendChild(list);
        }
        this.root.appendChild(body);
    }

    private toolbar() {
        const bar = document.createElement('div');
        bar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Glossary';
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = `${this.terms.length} terms`;
        bar.appendChild(h);
        bar.appendChild(meta);
        return bar;
    }

    private filterInput() {
        const input = document.createElement('input');
        input.className = 'search';
        input.type = 'search';
        input.placeholder = 'Filter terms';
        input.value = this.filter;
        input.addEventListener('input', () => {
            this.filter = input.value;
            this.paint();
        });
        return input;
    }

    private row(t: { term: string; count: number; context: string }) {
        const li = document.createElement('li');
        li.className = 'row';
        const term = document.createElement('span');
        term.className = 'term';
        term.textContent = t.term;
        const count = document.createElement('span');
        count.className = 'count';
        count.textContent = `${t.count}×`;
        li.appendChild(term);
        li.appendChild(count);
        if (t.context) {
            const ctx = document.createElement('span');
            ctx.className = 'ctx';
            ctx.textContent = t.context;
            li.appendChild(ctx);
        }
        return li;
    }

    private empty(text: string) {
        const div = document.createElement('div');
        div.className = 'empty';
        div.textContent = text;
        return div;
    }

    private filtered() {
        const q = this.filter.trim().toLowerCase();
        if (!q) return this.terms;
        return this.terms.filter((t) => t.term.toLowerCase().includes(q));
    }
}

customElements.define('glossary-view', GlossaryView);
