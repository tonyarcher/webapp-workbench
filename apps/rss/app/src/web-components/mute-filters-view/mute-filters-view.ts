import { loadMuteRules, saveMuteRules } from '../../services/mute-rules';
import type { MuteRule } from '../../services/mute-rules';
import styles from './mute-filters-view.css?inline';

export class MuteFiltersView extends HTMLElement {
    private rules: MuteRule[] = [];
    private root: HTMLDivElement | null = null;

    connectedCallback() {
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        shadow.appendChild(style);
        this.root = document.createElement('div');
        this.root.className = 'view';
        shadow.appendChild(this.root);
        this.rules = loadMuteRules();
        this.paint();
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Mute filters';
        toolbar.appendChild(h);
        const addBtn = document.createElement('button');
        addBtn.className = 'btn';
        addBtn.textContent = 'Add rule';
        addBtn.addEventListener('click', () => {
            const rule: MuteRule = {
                id: crypto.randomUUID(),
                terms: [''],
                match: 'title',
                enabled: true,
                scope: { kind: 'all' },
            };
            this.rules = [...this.rules, rule];
            saveMuteRules(this.rules);
            this.paint();
        });
        toolbar.appendChild(addBtn);
        this.root.appendChild(toolbar);
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        if (!this.rules.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No mute rules. Add one to hide noisy articles.';
            body.appendChild(empty);
        } else {
            const ul = document.createElement('ul');
            ul.className = 'list';
            for (const r of this.rules) {
                const li = document.createElement('li');
                li.className = 'row';
                const input = document.createElement('input');
                input.type = 'text';
                input.value = r.terms.join(', ');
                input.placeholder = 'Terms (comma-separated)';
                input.addEventListener('input', (e) => {
                    r.terms = (e.target as HTMLInputElement).value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean);
                    saveMuteRules(this.rules);
                });
                const del = document.createElement('button');
                del.className = 'btn danger';
                del.textContent = 'Delete';
                del.addEventListener('click', () => {
                    this.rules = this.rules.filter((x) => x.id !== r.id);
                    saveMuteRules(this.rules);
                    this.paint();
                });
                li.appendChild(input);
                li.appendChild(del);
                ul.appendChild(li);
            }
            body.appendChild(ul);
        }
        this.root.appendChild(body);
    }
}

customElements.define('mute-filters-view', MuteFiltersView);
