import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import actionGridCssText from './baseball-action-grid.css?inline';

const actionGridSheet = new CSSStyleSheet();
actionGridSheet.replaceSync(actionGridCssText);

@customElement('baseball-action-grid')
export class BaseballActionGrid extends LitElement {
    static styles = actionGridSheet;

    @property({type: String, attribute: 'current-pitch-type'}) currentPitchType = '';

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
        return html`
          <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'}" @click=${() => this.emitPitchType(pt)}>${pt}</button>
        `;
    }

    private renderPitchResults() {
        return html`
          <h3 class="section-title margin-top-md">PITCH RESULTS</h3>
          <div class="action-grid-3col">
            <button class="btn btn-action btn-ball" @click=${() => this.emitEvent('BALL')}>BALL</button>
            <button class="btn btn-action btn-strike" @click=${() => this.emitEvent('STRIKE')}>STRIKE LOOKING</button>
            <button class="btn btn-action btn-strike" @click=${() => this.emitEvent('STRIKE')}>STRIKE SWINGING</button>
            <button class="btn btn-action btn-foul" @click=${() => this.emitEvent('FOUL')}>FOUL BALL</button>
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
          <button class="btn btn-action btn-hit" @click=${() => this.emitStep2('SINGLE', 'Single (1B)')}>SINGLE (1B)</button>
          <button class="btn btn-action btn-hit" @click=${() => this.emitStep2('DOUBLE', 'Double (2B)')}>DOUBLE (2B)</button>
          <button class="btn btn-action btn-hit" @click=${() => this.emitStep2('TRIPLE', 'Triple (3B)')}>TRIPLE (3B)</button>
          <button class="btn btn-action btn-hit" @click=${() => this.emitStep2('HOME_RUN', 'Home Run (HR)')}>HOME RUN (HR)</button>
        `;
    }

    private renderWalkButtons() {
        return html`
          <button class="btn btn-action btn-walk" @click=${() => this.emitEvent('WALK')}>WALK (BB)</button>
          <button class="btn btn-action btn-walk" @click=${() => this.emitEvent('HIT_BY_PITCH')}>HIT BY PITCH (HBP)</button>
          <button class="btn btn-action btn-out" @click=${() => this.emitEvent('STRIKEOUT')}>STRIKEOUT (K)</button>
        `;
    }

    private renderOutButtons() {
        return html`
          <button class="btn btn-action btn-out" @click=${() => this.emitStep2('GROUNDOUT', 'Groundout')}>GROUNDOUT</button>
          <button class="btn btn-action btn-out" @click=${() => this.emitStep2('FLYOUT', 'Flyout')}>FLYOUT</button>
          <button class="btn btn-action btn-out" @click=${() => this.emitStep2('LINE_OUT', 'Line Out')}>LINE OUT</button>
          <button class="btn btn-action btn-out" @click=${() => this.emitStep2('POP_OUT', 'Pop Out')}>POP OUT</button>
          <button class="btn btn-action btn-out" @click=${() => this.emitStep2('SACRIFICE_FLY', 'Sac Fly')}>SAC FLY</button>
          <button class="btn btn-action btn-out" @click=${() => this.emitStep2('ERROR', 'Error (E)')}>ERROR (E)</button>
          <button class="btn btn-action btn-out" @click=${() => this.emitStep2('FIELDER_CHOICE', "Fielder's Choice")}>FIELDER'S CHOICE</button>
          <button class="btn btn-action btn-out" @click=${() => this.emitStep2('SACRIFICE_BUNT', 'Sac Bunt')}>SAC BUNT</button>
        `;
    }

    private renderBaserunning() {
        return html`
          <h3 class="section-title margin-top-md">BASERUNNING</h3>
          <div class="action-grid-3col">
            <button class="btn btn-action" @click=${() => this.emitEvent('STOLEN_BASE', {base: 2})}>SB 2B</button>
            <button class="btn btn-action" @click=${() => this.emitEvent('STOLEN_BASE', {base: 3})}>SB 3B</button>
            <button class="btn btn-action" @click=${() => this.emitEvent('STOLEN_BASE', {base: 4})}>SB HOME</button>
            <button class="btn btn-action" @click=${() => this.emitEvent('CAUGHT_STEALING', {base: 2})}>CS 2B</button>
            <button class="btn btn-action" @click=${() => this.emitEvent('CAUGHT_STEALING', {base: 3})}>CS 3B</button>
            <button class="btn btn-action" @click=${() => this.emitEvent('CAUGHT_STEALING', {base: 4})}>CS HOME</button>
            <button class="btn btn-action" @click=${() => this.emitEvent('WILD_PITCH')}>WILD PITCH</button>
            <button class="btn btn-action" @click=${() => this.emitEvent('PASSED_BALL')}>PASSED BALL</button>
            <button class="btn btn-action" @click=${() => this.emitEvent('BALK')}>BALK</button>
          </div>
        `;
    }

    private emitPitchType(pitchType: string) {
        this.dispatchEvent(
            new CustomEvent('pitch-type-selected', {
                detail: {pitchType},
                bubbles: true,
                composed: true,
            })
        );
    }

    private emitEvent(eventType: string, extra: Record<string, unknown> = {}) {
        this.dispatchEvent(
            new CustomEvent('trigger-scoring-event', {
                detail: {eventType, ...extra},
                bubbles: true,
                composed: true,
            })
        );
    }

    private emitStep2(eventType: string, baseLabel: string) {
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
