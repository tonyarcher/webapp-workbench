import { fetchEdition, fetchEditions } from '../../services/api';
import type { Edition, EditionMeta } from '../../types';
import styles from './brief-view.css?inline';

export class BriefView extends HTMLElement {
    private editions: EditionMeta[] = [];
    private current: Edition | null = null;
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
            this.editions = await fetchEditions(10);
            if (this.editions.length) {
                const first = this.editions[0];
                if (first) this.current = await fetchEdition(first.id);
            }
        } catch {
            this.editions = [];
            this.current = null;
        }
        this.loading = false;
        this.paint();
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Daily Brief';
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
        } else if (!this.current) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No brief available yet.';
            body.appendChild(empty);
        } else {
            for (const section of this.current.sections) {
                const sec = document.createElement('section');
                const title = document.createElement('h3');
                title.textContent = section.title;
                sec.appendChild(title);
                if (section.summary) {
                    const summary = document.createElement('p');
                    summary.textContent = section.summary;
                    sec.appendChild(summary);
                }
                body.appendChild(sec);
            }
        }
        this.root.appendChild(body);
    }
}

customElements.define('brief-view', BriefView);
