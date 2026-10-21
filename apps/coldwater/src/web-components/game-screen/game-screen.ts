import { LitElement, html, unsafeCSS } from 'lit';
import type { PropertyValues, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { POINTS_TIME_MS, availableActions, currentEncounter, currentSpecies } from '../../core/game';
import type { Action, Encounter, Phase, RunState, Species } from '../../core/types';
import '../fish-art/fish-art';
import { sceneAnimation } from './animation';
import styles from './game-screen.css?inline';

const ACTION_COPY: Readonly<Record<Action, { label: string; key: string; detail: string }>> = {
    eat: { label: 'Eat', key: 'E', detail: 'Try to swallow it' },
    chase: { label: 'Chase away', key: 'C', detail: 'Drive it off' },
    ignore: { label: 'Ignore', key: 'I', detail: 'Let it pass' },
    shallow: { label: 'Shallow escape', key: 'S', detail: 'Rise toward the light' },
    deep: { label: 'Deep escape', key: 'D', detail: 'Dive into the cold' },
};

function depthCopy(depth: 'shallow' | 'deep' | 'both'): string {
    if (depth === 'both') return 'Surface and deep water';
    return depth === 'shallow' ? 'Near the surface' : 'Deep water';
}

function deltaCopy(points: number): string {
    if (points > 0) return `+${points} points`;
    if (points < 0) return `${points} points`;
    return 'No score change';
}

@customElement('cw-game-screen')
export class CwGameScreen extends LitElement {
    static override styles = unsafeCSS(styles);

    @property({ attribute: false }) run: RunState | null = null;

    private previousPhase: Phase | null = null;

    private emitAction = (action: Action): void => {
        this.dispatchEvent(
            new CustomEvent('choose-action', {
                detail: action,
                bubbles: true,
                composed: true,
            }),
        );
    };

    private emitContinue = (): void => {
        this.dispatchEvent(new CustomEvent('continue-run', { bubbles: true, composed: true }));
    };

    private emitRestart = (): void => {
        this.dispatchEvent(new CustomEvent('restart', { bubbles: true, composed: true }));
    };

    private emitGuide = (): void => {
        this.dispatchEvent(new CustomEvent('open-guide', { bubbles: true, composed: true }));
    };

    override updated(changed: PropertyValues<this>): void {
        if (!changed.has('run')) return;
        const phase = this.run?.phase ?? null;
        if (phase !== this.previousPhase && (phase === 'resolved' || phase === 'dead')) {
            this.renderRoot.querySelector<HTMLElement>('.outcome h2')?.focus();
        }
        this.previousPhase = phase;
    }

    private renderHud(run: RunState, species: Species, revealName: boolean): TemplateResult {
        return html`
            <header class="hud">
                <div class="identity">
                    <p class="eyebrow">${run.mode === 'points' ? 'Points run' : 'Practice run'}</p>
                    <h1 tabindex="-1">${revealName ? species.name : 'Unidentified fish'}</h1>
                    <p class="depth">${depthCopy(species.depth)}</p>
                </div>
                <div class="stats">
                    ${run.mode === 'points' ? html`<p><span>Score</span><strong>${run.score}</strong></p>` : ''}
                    <p><span>Turn</span><strong>${run.totalEncounters + 1}</strong></p>
                    <button class="guide-link" type="button" @click=${this.emitGuide}>Field guide</button>
                </div>
            </header>
        `;
    }

    private renderTimer(run: RunState): TemplateResult {
        if (run.mode !== 'points' || run.phase !== 'choosing') return html``;
        const percent = Math.max(0, Math.min(100, (run.timeLeftMs / POINTS_TIME_MS) * 100));
        const seconds = (run.timeLeftMs / 1000).toFixed(1);
        return html`
            <div class="timer-wrap">
                <div
                    class="timer"
                    role="progressbar"
                    aria-label="Decision time"
                    aria-valuemin="0"
                    aria-valuemax=${POINTS_TIME_MS}
                    aria-valuenow=${Math.ceil(run.timeLeftMs)}
                    aria-valuetext="${seconds} seconds left"
                >
                    <span class="timer-fill" style="width: ${percent}%"></span>
                </div>
                <p class="timer-label">${seconds}s</p>
            </div>
        `;
    }

    private renderScene(run: RunState, species: Species, encounter: Encounter, revealName: boolean): TemplateResult {
        const animation = sceneAnimation(run, species, encounter);
        return html`
            <section class="scene ${animation.sceneClass}" aria-label="The water">
                <span class="depth-marker surface">Surface</span>
                <span class="depth-marker deep">Deep water</span>
                <div class="player ${animation.playerClass}">
                    <cw-fish-art
                        .art=${species.art}
                        motion=${animation.playerMotion}
                        mouth=${animation.playerMouth}
                        gulp=${animation.playerGulp}
                    ></cw-fish-art>
                    <span class="fish-label">${revealName ? species.name : 'Your fish'}</span>
                </div>
                <div class="encounter ${encounter.depth} ${animation.encounterClass}">
                    <cw-fish-art
                        .art=${encounter.art}
                        motion=${animation.encounterMotion}
                        mouth=${animation.encounterMouth}
                    ></cw-fish-art>
                    <span class="fish-label">${revealName ? encounter.name : 'Unknown'}</span>
                </div>
                <span class="scene-flash" aria-hidden="true"></span>
            </section>
        `;
    }

    private renderPrompt(encounter: Encounter, revealName: boolean): TemplateResult {
        return html`
            <section class="prompt" aria-live="polite">
                <p class="clue">${revealName ? encounter.description : encounter.clue}</p>
                ${revealName ? '' : html`<p class="hint">Read the shape, colour, and depth before you choose.</p>`}
            </section>
        `;
    }

    private renderAction(action: Action): TemplateResult {
        const copy = ACTION_COPY[action];
        return html`
            <button type="button" class="action" @click=${() => this.emitAction(action)}>
                <span class="action-top">
                    <span>${copy.label}</span>
                    <kbd>${copy.key}</kbd>
                </span>
                <span class="action-detail">${copy.detail}</span>
            </button>
        `;
    }

    private renderActions(run: RunState): TemplateResult {
        if (run.phase !== 'choosing') return html``;
        return html`
            <div class="actions" role="group" aria-label="Choose a move">
                ${availableActions(run).map((action) => this.renderAction(action))}
            </div>
        `;
    }

    private renderOutcomeFooter(run: RunState, pointsMode: boolean): TemplateResult {
        if (run.phase === 'dead') {
            return html`
                <p class="final">
                    ${pointsMode ? `Final score: ${run.score}` : 'The lake does not keep score in practice.'}
                </p>
                <button class="primary" type="button" @click=${this.emitRestart}>Start over</button>
            `;
        }
        return html`<button class="primary" type="button" @click=${this.emitContinue}>Continue</button>`;
    }

    private renderOutcome(run: RunState, pointsMode: boolean): TemplateResult {
        const outcome = run.outcome;
        if (!outcome) return html``;
        return html`
            <section class="outcome ${outcome.tone}" role="status" aria-live="polite">
                <h2 tabindex="-1">${outcome.title}</h2>
                <p>${outcome.detail}</p>
                <p class="delta">${deltaCopy(outcome.points)}</p>
                ${this.renderOutcomeFooter(run, pointsMode)}
            </section>
        `;
    }

    override render(): TemplateResult {
        const run = this.run;
        if (!run) return html``;
        const species = currentSpecies(run);
        const encounter = currentEncounter(run);
        const revealName = run.mode !== 'points' || run.phase !== 'choosing';
        return html`
            <main class="game">
                ${this.renderHud(run, species, revealName)} ${this.renderTimer(run)}
                ${this.renderScene(run, species, encounter, revealName)} ${this.renderPrompt(encounter, revealName)}
                ${this.renderActions(run)} ${this.renderOutcome(run, run.mode === 'points')}
            </main>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cw-game-screen': CwGameScreen;
    }
}
