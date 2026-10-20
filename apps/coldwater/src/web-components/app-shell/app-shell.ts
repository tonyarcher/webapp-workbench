import { LitElement, html, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { availableActions, chooseAction, continueRun, startRun, tick } from '../../core/game';
import { randomAt } from '../../core/rng';
import type { Action, Mode, RunState, SpeciesId } from '../../core/types';
import { readHighScore, writeHighScore } from '../../services/high-score';
import '../field-guide/field-guide';
import '../game-screen/game-screen';
import '../start-screen/start-screen';
import styles from './app-shell.css?inline';

type View = 'menu' | 'game' | 'guide';

const KEY_ACTIONS: Readonly<Record<string, Action>> = {
    e: 'eat',
    c: 'chase',
    i: 'ignore',
    s: 'shallow',
    d: 'deep',
};

function makeSeed(): number {
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

@customElement('cw-app-shell')
export class CwAppShell extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private view: View = 'menu';
    @state() private run: RunState | null = null;
    @state() private highScore = 0;

    private timer: ReturnType<typeof setInterval> | null = null;
    private returnView: 'menu' | 'game' = 'menu';
    private readonly intervalMs = 250;

    override connectedCallback(): void {
        super.connectedCallback();
        this.highScore = readHighScore();
        window.addEventListener('keydown', this.onKeyDown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        window.removeEventListener('keydown', this.onKeyDown);
        this.stopTimer();
    }

    private onStart = (event: Event): void => {
        const detail = (event as CustomEvent<{ mode: Mode; speciesId: SpeciesId }>).detail;
        this.stopTimer();
        this.run = startRun(detail.mode, detail.speciesId, makeSeed());
        this.view = 'game';
        this.startTimer();
    };

    private onAction = (event: Event): void => {
        if (!this.run || this.run.phase !== 'choosing') return;
        const action = (event as CustomEvent<Action>).detail;
        this.stopTimer();
        this.run = chooseAction(this.run, action, randomAt(this.run.seed, this.run.step));
        this.settle();
    };

    private onContinue = (): void => {
        if (!this.run) return;
        this.run = continueRun(this.run);
        this.settle();
    };

    private onRestart = (): void => {
        this.stopTimer();
        this.run = null;
        this.view = 'menu';
        this.highScore = readHighScore();
    };

    private onOpenGuide = (): void => {
        this.returnView = this.view === 'game' ? 'game' : 'menu';
        this.stopTimer();
        this.view = 'guide';
    };

    private onCloseGuide = (): void => {
        this.view = this.returnView;
        this.settle();
    };

    private isTypingTarget(target: EventTarget | null): boolean {
        if (!(target instanceof HTMLElement)) return false;
        return (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
        );
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        const run = this.run;
        if (!run || this.view !== 'game' || run.phase !== 'choosing') return;
        if (event.altKey || event.ctrlKey || event.metaKey || this.isTypingTarget(event.target)) return;
        const action = KEY_ACTIONS[event.key.toLowerCase()];
        if (!action || !availableActions(run).includes(action)) return;
        event.preventDefault();
        this.stopTimer();
        this.run = chooseAction(run, action, randomAt(run.seed, run.step));
        this.settle();
    };

    private startTimer(): void {
        this.stopTimer();
        if (this.view !== 'game' || !this.run || this.run.mode !== 'points' || this.run.phase !== 'choosing') return;
        this.timer = setInterval(this.onTick, this.intervalMs);
    }

    private stopTimer(): void {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    private onTick = (): void => {
        if (!this.run || this.view !== 'game' || this.run.mode !== 'points' || this.run.phase !== 'choosing') {
            this.stopTimer();
            return;
        }
        const next = tick(this.run, this.intervalMs);
        this.run = next;
        if (next.phase !== 'choosing') {
            this.stopTimer();
            this.settle();
        }
    };

    private settle(): void {
        const run = this.run;
        if (!run) {
            this.stopTimer();
            return;
        }
        if (run.phase === 'dead') {
            if (run.mode === 'points') writeHighScore(run.score);
            this.highScore = readHighScore();
            this.stopTimer();
            return;
        }
        if (run.phase === 'resolved') {
            this.stopTimer();
            return;
        }
        if (this.view === 'game' && run.mode === 'points') {
            this.startTimer();
        }
    }

    override render(): TemplateResult {
        if (this.view === 'guide') {
            return html`<cw-field-guide @close=${this.onCloseGuide}></cw-field-guide>`;
        }
        if (this.view === 'game' && this.run) {
            return html`
                <cw-game-screen
                    .run=${this.run}
                    @choose-action=${this.onAction}
                    @continue-run=${this.onContinue}
                    @restart=${this.onRestart}
                    @open-guide=${this.onOpenGuide}
                ></cw-game-screen>
            `;
        }
        return html`
            <cw-start-screen
                .highScore=${this.highScore}
                @start-run=${this.onStart}
                @open-guide=${this.onOpenGuide}
            ></cw-start-screen>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cw-app-shell': CwAppShell;
    }
}
