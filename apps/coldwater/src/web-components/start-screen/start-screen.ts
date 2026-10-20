import { LitElement, html, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SPECIES_LIST, speciesById } from '../../core/data';
import type { Mode, SpeciesId } from '../../core/types';
import '../fish-art/fish-art';
import styles from './start-screen.css?inline';

function depthLabel(depth: 'shallow' | 'deep' | 'both'): string {
    if (depth === 'both') return 'surface and deep';
    return depth === 'shallow' ? 'near the surface' : 'deep water';
}

@customElement('cw-start-screen')
export class CwStartScreen extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ type: Number }) highScore = 0;

    @state() private mode: Mode = 'practice';
    @state() private speciesId: SpeciesId = 'walleye';

    private setMode = (mode: Mode): void => {
        this.mode = mode;
    };

    private setSpecies = (speciesId: SpeciesId): void => {
        this.speciesId = speciesId;
    };

    private emitStart = (): void => {
        this.dispatchEvent(
            new CustomEvent('start-run', {
                detail: { mode: this.mode, speciesId: this.speciesId },
                bubbles: true,
                composed: true,
            }),
        );
    };

    private emitGuide = (): void => {
        this.dispatchEvent(new CustomEvent('open-guide', { bubbles: true, composed: true }));
    };

    private renderSpeciesPicker(): TemplateResult {
        return html`
            <div class="species-picker" role="group" aria-label="Choose a fish">
                ${SPECIES_LIST.map((species) => {
                    const selected = species.id === this.speciesId;
                    return html`
                        <button
                            class="species-card"
                            type="button"
                            aria-pressed=${selected}
                            @click=${() => this.setSpecies(species.id)}
                        >
                            <cw-fish-art class="species-art" .art=${species.art}></cw-fish-art>
                            <span class="species-name">${species.name}</span>
                            <span class="species-meta">${depthLabel(species.depth)}</span>
                        </button>
                    `;
                })}
            </div>
        `;
    }

    private renderModeCard(mode: Mode, name: string, copy: string): TemplateResult {
        return html`
            <button
                class="mode-card"
                type="button"
                aria-pressed=${this.mode === mode}
                @click=${() => this.setMode(mode)}
            >
                <span class="mode-name">${name}</span>
                <span class="mode-copy">${copy}</span>
            </button>
        `;
    }

    private renderModes(): TemplateResult {
        return html`
            <section class="panel" aria-labelledby="mode-heading">
                <h2 id="mode-heading">Choose a mode</h2>
                <div class="mode-row" role="group" aria-label="Game mode">
                    ${this.renderModeCard('practice', 'Practice', 'See every name. No clock. Learn the water.')}
                    ${this.renderModeCard(
                        'points',
                        'Play for points',
                        'A random fish. Hidden names. Ten seconds per decision.',
                    )}
                </div>
            </section>
        `;
    }

    private renderFishSection(): TemplateResult {
        const chosen = speciesById(this.speciesId);
        return html`
            <section class="panel" aria-labelledby="fish-heading">
                <h2 id="fish-heading">${this.mode === 'practice' ? 'Choose your fish' : 'Your fish is a mystery'}</h2>
                ${
                    this.mode === 'practice'
                        ? this.renderSpeciesPicker()
                        : html`<p class="note">
                          The lake will hand you a fish at random. Its name stays hidden until the turn is resolved.
                      </p>`
                }
                <p class="chosen">
                    ${
                        this.mode === 'practice'
                            ? `${chosen.name}: ${chosen.fact}`
                            : 'Watch the shape, the colour, and the depth. Those are your clues.'
                    }
                </p>
            </section>
        `;
    }

    private renderRules(): TemplateResult {
        return html`
            <section class="panel rules" aria-labelledby="rules-heading">
                <h2 id="rules-heading">Five moves</h2>
                <ul>
                    <li><strong>Eat</strong> what belongs in your diet.</li>
                    <li><strong>Chase</strong> a rival away, if you dare.</li>
                    <li><strong>Ignore</strong> a threat that cannot reach you.</li>
                    <li><strong>Shallow escape</strong> toward the light.</li>
                    <li><strong>Deep escape</strong> into the cold.</li>
                </ul>
                <p class="keys">Keys: <kbd>E</kbd> <kbd>C</kbd> <kbd>I</kbd> <kbd>S</kbd> <kbd>D</kbd></p>
            </section>
        `;
    }

    private renderActions(): TemplateResult {
        return html`
            <div class="actions">
                <button class="primary" type="button" @click=${this.emitStart}>Enter the lake</button>
                <button class="secondary" type="button" @click=${this.emitGuide}>Field guide</button>
            </div>
            ${this.highScore > 0 ? html`<p class="best">Best score: ${this.highScore}</p>` : ''}
        `;
    }

    override render(): TemplateResult {
        return html`
            <main class="start">
                <header class="hero">
                    <p class="eyebrow">A lake-survival game</p>
                    <h1 tabindex="-1">Coldwater</h1>
                    <p class="lede">
                        You are one fish in cold, crowded water. Read the signs, pick a move, and keep your place in the
                        food web.
                    </p>
                </header>
                ${this.renderModes()} ${this.renderFishSection()} ${this.renderRules()} ${this.renderActions()}
            </main>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cw-start-screen': CwStartScreen;
    }
}
