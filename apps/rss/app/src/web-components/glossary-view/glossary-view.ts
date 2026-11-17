import { html, LitElement, unsafeCSS } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { getAllArticles } from '../../db/db-query';
import { extractTerms, termContext } from '../../services/glossary';
import styles from './glossary-view.css?inline';

interface TermEntry {
    term: string;
    count: number;
    context: string;
}

@customElement('glossary-view')
export class GlossaryView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private terms: TermEntry[] = [];
    @state() private loading = true;
    @state() private filter = '';

    override connectedCallback() {
        super.connectedCallback();
        void this.load();
    }

    private async load() {
        this.loading = true;
        try {
            const articles = await getAllArticles();
            const read = articles.filter((a) => a.read === 1);
            const map = new Map<string, number>();
            for (const a of read) {
                for (const t of extractTerms(a.content ?? a.summary ?? '')) {
                    map.set(t, (map.get(t) ?? 0) + 1);
                }
            }
            this.terms = [...map.entries()]
                .map(([term, count]) => ({ term, count, context: termContext(read, term) }))
                .sort((a, b) => b.count - a.count);
        } catch {
            this.terms = [];
        }
        this.loading = false;
    }

    private get filtered() {
        const q = this.filter.trim().toLowerCase();
        if (!q) return this.terms;
        return this.terms.filter((t) => t.term.toLowerCase().includes(q));
    }

    override render() {
        return html`
            <div class="view">
                <div class="toolbar"><h2>Glossary</h2><span class="meta">${this.terms.length} terms</span></div>
                <div class="body" tabindex="0">
                    <input class="search" type="search" placeholder="Filter terms" .value=${this.filter} @input=${(e: Event) => (this.filter = (e.target as HTMLInputElement).value)} />
                    ${this.loading ? html`<div class="empty">Loading…</div>` : ''}
                    ${!this.loading && !this.filtered.length ? html`<div class="empty">No terms yet. Read some articles first.</div>` : ''}
                    <ul class="list">
                        ${this.filtered.map(
                            (t) => html`
                            <li class="row">
                                <span class="term">${t.term}</span>
                                <span class="count">${t.count}×</span>
                                ${t.context ? html`<span class="ctx">${t.context}</span>` : ''}
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
        'glossary-view': GlossaryView;
    }
}
