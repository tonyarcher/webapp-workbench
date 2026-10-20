import { LitElement, html, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { SPECIES_LIST, encounterById } from '../../core/data';
import type { EncounterId, Species } from '../../core/types';
import '../fish-art/fish-art';
import styles from './field-guide.css?inline';

function names(ids: readonly EncounterId[]): string {
    return ids.map((id) => encounterById(id).name).join(', ');
}

function depthLabel(depth: 'shallow' | 'deep' | 'both'): string {
    if (depth === 'both') return 'Surface and deep water';
    return depth === 'shallow' ? 'Near the surface' : 'Deep water';
}

@customElement('cw-field-guide')
export class CwFieldGuide extends LitElement {
    static override styles = unsafeCSS(styles);

    private emitClose = (): void => {
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    };

    private renderHeader(): TemplateResult {
        return html`
            <header class="guide-header">
                <div>
                    <p class="eyebrow">Read the water</p>
                    <h1 tabindex="-1">Field guide</h1>
                    <p class="lede">
                        Every animal here is part of the same food web. Learn the shape, the depth, and the diet before
                        you swim.
                    </p>
                </div>
                <button class="back" type="button" @click=${this.emitClose}>Back to the lake</button>
            </header>
        `;
    }

    private renderDiet(species: Species): TemplateResult {
        return html`
            <dl>
                <div>
                    <dt>Eats</dt>
                    <dd>${names(species.eats)}</dd>
                </div>
                <div>
                    <dt>Watch for</dt>
                    <dd>${species.predators.length > 0 ? names(species.predators) : 'Anglers only'}</dd>
                </div>
            </dl>
        `;
    }

    private renderCard(species: Species): TemplateResult {
        return html`
            <article class="card" aria-labelledby="fish-${species.id}">
                <cw-fish-art class="card-art" .art=${species.art}></cw-fish-art>
                <div class="card-body">
                    <h2 id="fish-${species.id}">${species.name}</h2>
                    <p class="meta">
                        ${depthLabel(species.depth)} · ${species.canShallow ? 'can rise' : 'deep-bound'}
                    </p>
                    <p class="fact">${species.fact}</p>
                    ${this.renderDiet(species)}
                </div>
            </article>
        `;
    }

    override render(): TemplateResult {
        return html`
            <main class="guide">
                ${this.renderHeader()}
                <div class="cards">${SPECIES_LIST.map((species) => this.renderCard(species))}</div>
            </main>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cw-field-guide': CwFieldGuide;
    }
}
