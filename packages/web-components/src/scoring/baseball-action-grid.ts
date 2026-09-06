import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import actionGridCssText from './baseball-action-grid.css?inline';

const actionGridSheet = new CSSStyleSheet();
actionGridSheet.replaceSync(actionGridCssText);

@customElement('baseball-action-grid')
export class BaseballActionGrid extends LitElement {
    static styles = actionGridSheet;

    @property({type: String, attribute: 'current-pitch-type'}) currentPitchType = '';
    @property({type: String, attribute: 'active-play-json'}) activePlayJson = '';
    @property({
        attribute: 'interactive',
        converter: {
            fromAttribute: (value: string | null) => value !== 'false',
            toAttribute: (value: boolean) => (value ? 'true' : 'false'),
        },
        reflect: true,
    })
    interactive = true;
    @property({
        attribute: 'animations',
        converter: {
            fromAttribute: (value: string | null) => value !== 'false',
            toAttribute: (value: boolean) => (value ? 'true' : 'false'),
        },
        reflect: true,
    })
    animations = true;

    render() {
        return html`
            <div class="card action-card">
                ${this.renderPitchTypes()}
                ${this.renderPitchResults()}
                ${this.renderPlateResults()}
                ${this.renderBaserunning()}
            </div>
        `;
    }

    private renderPitchTypes() {
        return html`
          <h3 class="section-title">PITCH SELECTION (OPTIONAL)</h3>
          <div class="pitch-types-row">
            ${['Fastball', 'Curveball', 'Slider', 'Changeup', 'Sinker', 'Cutter'].map((pt) => this.renderPitchTypeButton(pt))}
          </div>
        `;
    }

    private renderPitchTypeButton(pt: string) {
        const isSelected = pt === this.currentPitchType;
        const pressed = this.isPressed({pitchType: pt});
        return html`
          <button
              class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} ${pressed}"
              data-action="PITCH_TYPE"
              data-pitch-type=${pt}
              @click=${() => this.emitPitchType(pt)}
          >${pt}</button>
        `;
    }

    private renderPitchResults() {
        return html`
          <h3 class="section-title margin-top-md">PITCH RESULTS</h3>
          <div class="action-grid-3col">
            <button class="btn btn-action btn-ball ${this.isPressed({eventType: 'BALL'})}" data-action="BALL" @click=${() => this.emitEvent('BALL')}>BALL</button>
            <button class="btn btn-action btn-strike ${this.isPressed({eventType: 'STRIKE', variant: 'looking'})}" data-action="STRIKE" data-variant="looking" @click=${() => this.emitEvent('STRIKE')}>STRIKE LOOKING</button>
            <button class="btn btn-action btn-strike ${this.isPressed({eventType: 'STRIKE', variant: 'swinging'})}" data-action="STRIKE" data-variant="swinging" @click=${() => this.emitEvent('STRIKE')}>STRIKE SWINGING</button>
            <button class="btn btn-action btn-foul ${this.isPressed({eventType: 'FOUL'})}" data-action="FOUL" @click=${() => this.emitEvent('FOUL')}>FOUL BALL</button>
          </div>
        `;
    }

    private renderPlateResults() {
        return html`
          <h3 class="section-title margin-top-md">PLATE & IN-PLAY RESULTS</h3>
          <div class="action-grid-3col">
            ${this.renderHitButtons()} ${this.renderWalkButtons()} ${this.renderOutButtons()}
          </div>
        `;
    }

    private renderHitButtons() {
        return html`
          <button class="btn btn-action btn-hit ${this.isPressed({eventType: 'SINGLE'})}" data-action="SINGLE" @click=${() => this.emitStep2('SINGLE', 'Single (1B)')}>SINGLE (1B)</button>
          <button class="btn btn-action btn-hit ${this.isPressed({eventType: 'DOUBLE'})}" data-action="DOUBLE" @click=${() => this.emitStep2('DOUBLE', 'Double (2B)')}>DOUBLE (2B)</button>
          <button class="btn btn-action btn-hit ${this.isPressed({eventType: 'TRIPLE'})}" data-action="TRIPLE" @click=${() => this.emitStep2('TRIPLE', 'Triple (3B)')}>TRIPLE (3B)</button>
          <button class="btn btn-action btn-hit ${this.isPressed({eventType: 'HOME_RUN'})}" data-action="HOME_RUN" @click=${() => this.emitStep2('HOME_RUN', 'Home Run (HR)')}>HOME RUN (HR)</button>
        `;
    }

    private renderWalkButtons() {
        return html`
          <button class="btn btn-action btn-walk ${this.isPressed({eventType: 'WALK'})}" data-action="WALK" @click=${() => this.emitEvent('WALK')}>WALK (BB)</button>
          <button class="btn btn-action btn-walk ${this.isPressed({eventType: 'HIT_BY_PITCH'})}" data-action="HIT_BY_PITCH" @click=${() => this.emitEvent('HIT_BY_PITCH')}>HIT BY PITCH (HBP)</button>
          <button class="btn btn-action btn-out ${this.isPressed({eventType: 'STRIKEOUT'})}" data-action="STRIKEOUT" @click=${() => this.emitEvent('STRIKEOUT')}>STRIKEOUT (K)</button>
        `;
    }

    private renderOutButtons() {
        return html`
          <button class="btn btn-action btn-out ${this.isPressed({eventType: 'GROUNDOUT'})}" data-action="GROUNDOUT" @click=${() => this.emitStep2('GROUNDOUT', 'Groundout')}>GROUNDOUT</button>
          <button class="btn btn-action btn-out ${this.isPressed({eventType: 'FLYOUT'})}" data-action="FLYOUT" @click=${() => this.emitStep2('FLYOUT', 'Flyout')}>FLYOUT</button>
          <button class="btn btn-action btn-out ${this.isPressed({eventType: 'LINE_OUT'})}" data-action="LINE_OUT" @click=${() => this.emitStep2('LINE_OUT', 'Line Out')}>LINE OUT</button>
          <button class="btn btn-action btn-out ${this.isPressed({eventType: 'POP_OUT'})}" data-action="POP_OUT" @click=${() => this.emitStep2('POP_OUT', 'Pop Out')}>POP OUT</button>
          <button class="btn btn-action btn-out ${this.isPressed({eventType: 'SACRIFICE_FLY'})}" data-action="SACRIFICE_FLY" @click=${() => this.emitStep2('SACRIFICE_FLY', 'Sac Fly')}>SAC FLY</button>
          <button class="btn btn-action btn-out ${this.isPressed({eventType: 'ERROR'})}" data-action="ERROR" @click=${() => this.emitStep2('ERROR', 'Error (E)')}>ERROR (E)</button>
          <button class="btn btn-action btn-out ${this.isPressed({eventType: 'FIELDER_CHOICE'})}" data-action="FIELDER_CHOICE" @click=${() => this.emitStep2('FIELDER_CHOICE', "Fielder's Choice")}>FIELDER'S CHOICE</button>
          <button class="btn btn-action btn-out ${this.isPressed({eventType: 'SACRIFICE_BUNT'})}" data-action="SACRIFICE_BUNT" @click=${() => this.emitStep2('SACRIFICE_BUNT', 'Sac Bunt')}>SAC BUNT</button>
        `;
    }

    private renderBaserunning() {
        return html`
          <h3 class="section-title margin-top-md">BASERUNNING</h3>
          <div class="action-grid-3col">
            <button class="btn btn-action ${this.isPressed({eventType: 'STOLEN_BASE', base: 2})}" data-action="STOLEN_BASE" data-base="2" @click=${() => this.emitEvent('STOLEN_BASE', {base: 2})}>SB 2B</button>
            <button class="btn btn-action ${this.isPressed({eventType: 'STOLEN_BASE', base: 3})}" data-action="STOLEN_BASE" data-base="3" @click=${() => this.emitEvent('STOLEN_BASE', {base: 3})}>SB 3B</button>
            <button class="btn btn-action ${this.isPressed({eventType: 'STOLEN_BASE', base: 4})}" data-action="STOLEN_BASE" data-base="4" @click=${() => this.emitEvent('STOLEN_BASE', {base: 4})}>SB HOME</button>
            <button class="btn btn-action ${this.isPressed({eventType: 'CAUGHT_STEALING', base: 2})}" data-action="CAUGHT_STEALING" data-base="2" @click=${() => this.emitEvent('CAUGHT_STEALING', {base: 2})}>CS 2B</button>
            <button class="btn btn-action ${this.isPressed({eventType: 'CAUGHT_STEALING', base: 3})}" data-action="CAUGHT_STEALING" data-base="3" @click=${() => this.emitEvent('CAUGHT_STEALING', {base: 3})}>CS 3B</button>
            <button class="btn btn-action ${this.isPressed({eventType: 'CAUGHT_STEALING', base: 4})}" data-action="CAUGHT_STEALING" data-base="4" @click=${() => this.emitEvent('CAUGHT_STEALING', {base: 4})}>CS HOME</button>
            <button class="btn btn-action ${this.isPressed({eventType: 'WILD_PITCH'})}" data-action="WILD_PITCH" @click=${() => this.emitEvent('WILD_PITCH')}>WILD PITCH</button>
            <button class="btn btn-action ${this.isPressed({eventType: 'PASSED_BALL'})}" data-action="PASSED_BALL" @click=${() => this.emitEvent('PASSED_BALL')}>PASSED BALL</button>
            <button class="btn btn-action ${this.isPressed({eventType: 'BALK'})}" data-action="BALK" @click=${() => this.emitEvent('BALK')}>BALK</button>
          </div>
        `;
    }

    private activePlay(): Record<string, unknown> | null {
        if (!this.activePlayJson) return null;
        try {
            const parsed = JSON.parse(this.activePlayJson) as unknown;
            return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, unknown> : null;
        } catch {
            return null;
        }
    }

    private isPressed(match: {eventType?: string; variant?: string; base?: number; pitchType?: string}): string {
        const play = this.activePlay();
        if (!play) return '';
        if (match.pitchType) return play.pitchType === match.pitchType ? 'sim-press' : '';
        if (play.eventType !== match.eventType) return '';
        if (match.base != null && Number(play.base) !== match.base) return '';
        if (match.variant && play.strikeKind && play.strikeKind !== match.variant) return '';
        return 'sim-press';
    }

    private emitPitchType(pitchType: string) {
        if (!this.interactive) return;
        this.dispatchEvent(
            new CustomEvent('pitch-type-selected', {
                detail: {pitchType},
                bubbles: true,
                composed: true,
            })
        );
    }

    private emitEvent(eventType: string, extra: Record<string, unknown> = {}) {
        if (!this.interactive) return;
        this.dispatchEvent(
            new CustomEvent('trigger-scoring-event', {
                detail: {eventType, ...extra},
                bubbles: true,
                composed: true,
            })
        );
    }

    private emitStep2(eventType: string, baseLabel: string) {
        if (!this.interactive) return;
        this.dispatchEvent(
            new CustomEvent('render-step2', {
                detail: {eventType, baseLabel},
                bubbles: true,
                composed: true,
            })
        );
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-action-grid': BaseballActionGrid;
    }
}
