import { fetchArticleById, fetchEdition, fetchEditions } from '../../services/api';
import {
    BRIEF_TIERS,
    BRIEF_TIER_LABELS,
    buildBriefTiers,
    isBriefTier,
    type BriefTier,
    type BriefTierSection,
    type BriefTiers,
} from '../../services/brief-tiers';
import type { Edition, EditionExcerpt, EditionMeta, EditionSection } from '../../types';
import styles from './brief-view.css?inline';

const TIER_KEY = 'times-up:brief-tier';

function loadTier(): BriefTier {
    try {
        const raw = localStorage.getItem(TIER_KEY);
        return isBriefTier(raw) ? raw : 'minute';
    } catch {
        return 'minute';
    }
}

function saveTier(tier: BriefTier): void {
    try {
        localStorage.setItem(TIER_KEY, tier);
    } catch {
        // The selected depth is a convenience, not a requirement.
    }
}

export class BriefView extends HTMLElement {
    private editions: EditionMeta[] = [];
    private current: Edition | null = null;
    private tiers: BriefTiers = buildBriefTiers([]);
    private tier: BriefTier = loadTier();
    private loading = true;
    private root: HTMLDivElement | null = null;
    private readonly scrollByTier = new Map<BriefTier, number>();

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
            const first = this.editions[0];
            if (first) this.current = await fetchEdition(first.id);
            this.tiers = buildBriefTiers(this.current?.sections ?? []);
        } catch {
            this.editions = [];
            this.current = null;
            this.tiers = buildBriefTiers([]);
        }
        this.loading = false;
        this.paint();
    }

    private switchTier(tier: BriefTier) {
        if (tier === this.tier) return;
        this.scrollByTier.set(this.tier, this.scrollTop);
        this.tier = tier;
        saveTier(tier);
        this.paint();
        requestAnimationFrame(() => {
            this.scrollTop = this.scrollByTier.get(tier) ?? 0;
        });
    }

    private paint() {
        if (!this.root) return;
        this.root.replaceChildren();
        this.root.appendChild(this.buildToolbar());
        const body = document.createElement('div');
        body.className = 'body';
        body.tabIndex = 0;
        if (this.loading) {
            body.appendChild(this.empty('Loading…'));
        } else if (!this.current) {
            body.appendChild(this.empty('No brief available yet.'));
        } else {
            if (this.current.opinion) body.appendChild(this.summaryCard(this.current.opinion));
            for (const section of this.tiers[this.tier]) {
                body.appendChild(this.section(section, this.tier === 'deep' ? this.allSourceIds(section) : []));
            }
        }
        this.root.appendChild(body);
    }

    private buildToolbar(): HTMLDivElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'toolbar';
        const h = document.createElement('h2');
        h.textContent = 'Daily Brief';
        toolbar.appendChild(h);
        for (const tier of BRIEF_TIERS) {
            const button = document.createElement('button');
            button.className = 'btn tier';
            button.type = 'button';
            button.textContent = BRIEF_TIER_LABELS[tier];
            button.setAttribute('aria-pressed', String(tier === this.tier));
            button.addEventListener('click', () => this.switchTier(tier));
            toolbar.appendChild(button);
        }
        return toolbar;
    }

    private empty(text: string): HTMLDivElement {
        const node = document.createElement('div');
        node.className = 'empty';
        node.textContent = text;
        return node;
    }

    private summaryCard(text: string): HTMLDivElement {
        const card = document.createElement('div');
        card.className = 'summary-card';
        const head = document.createElement('div');
        head.className = 'head';
        head.textContent = 'Editorial opinion';
        card.appendChild(head);
        const body = document.createElement('p');
        body.className = 'summary-text';
        body.textContent = text;
        card.appendChild(body);
        return card;
    }

    private section(section: BriefTierSection, sourceIds: string[]): HTMLElement {
        const node = document.createElement('section');
        const title = document.createElement('h3');
        title.textContent = section.topic ?? section.title;
        node.appendChild(title);
        if (section.delta === 'new') {
            const badge = document.createElement('span');
            badge.className = 'delta-badge';
            badge.textContent = 'New';
            node.appendChild(badge);
        }
        if (section.summary) {
            const summary = document.createElement('p');
            summary.className = 'section-summary';
            summary.textContent = section.summary;
            node.appendChild(summary);
        }
        const list = document.createElement('div');
        list.className = 'excerpts';
        for (const item of section.items) list.appendChild(this.excerpt(item));
        node.appendChild(list);
        if (sourceIds.length) node.appendChild(this.sources(sourceIds));
        return node;
    }

    private excerpt(item: EditionExcerpt): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'excerpt';
        button.type = 'button';
        const cite = document.createElement('span');
        cite.className = 'cite';
        cite.textContent = item.title;
        const text = document.createElement('span');
        text.className = 'excerpt-text';
        text.textContent = item.text;
        button.append(cite, text);
        button.addEventListener('click', () => void this.open(item.articleId));
        return button;
    }

    private sources(ids: string[]): HTMLElement {
        const row = document.createElement('div');
        row.className = 'sources';
        for (const id of ids) {
            const button = document.createElement('button');
            button.className = 'source';
            button.type = 'button';
            button.textContent = this.sourceLabel(id);
            button.addEventListener('click', () => void this.open(id));
            row.appendChild(button);
        }
        return row;
    }

    private allSourceIds(section: BriefTierSection): string[] {
        const original = (this.current?.sections ?? []).find((item: EditionSection) => item.id === section.id);
        return original?.articleIds ?? section.items.map((item) => item.articleId);
    }

    private sourceLabel(id: string): string {
        for (const section of this.current?.sections ?? []) {
            const match = section.excerpts?.find((item) => item.articleId === id);
            if (match?.title) return match.title;
        }
        return id.length > 12 ? `${id.slice(0, 8)}…` : id;
    }

    private async open(articleId: string): Promise<void> {
        try {
            const article = await fetchArticleById(articleId);
            if (!this.isConnected) return;
            this.dispatchEvent(
                new CustomEvent('open-article', {
                    detail: { article, index: 0, items: [article] },
                    bubbles: true,
                    composed: true,
                }),
            );
        } catch {
            // A cited source may have been removed since the edition was built.
        }
    }
}

customElements.define('brief-view', BriefView);
