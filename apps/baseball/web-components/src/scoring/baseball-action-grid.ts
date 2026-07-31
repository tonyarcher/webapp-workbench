import { html, css, unsafeCSS, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import actionGridCss from './baseball-action-grid.css?inline';

@customElement('baseball-action-grid')
export class BaseballActionGrid extends LitElement {
  static styles = css`${unsafeCSS(actionGridCss)}`;

  @property({ type: String, attribute: 'current-pitch-type' }) currentPitchType: string | null = null;

  private selectPitchType(pType: string) {
    const selected = this.currentPitchType === pType ? '' : pType;
    this.setAttribute('selected-pitch-type', selected);
    this.dispatchEvent(new Event('pitch-type-selected', { bubbles: true }));
  }

  private triggerEvent(eventType: string) {
    this.setAttribute('triggered-event-type', eventType);
    this.dispatchEvent(new Event('action-triggered', { bubbles: true }));
  }

  private triggerStep2(eventType: string, label: string) {
    this.setAttribute('step2-event-type', eventType);
    this.setAttribute('step2-label', label);
    this.dispatchEvent(new Event('step2-requested', { bubbles: true }));
  }

  render() {
    const pitchTypes = ['Fastball', 'Breaking Ball', 'Offspeed'];

    return html`
      <div class="flex-gap-sm margin-bottom-md">
        ${pitchTypes.map((pType) => {
          const isSelected = pType === this.currentPitchType;
          return html`
            <button
              class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} flex-grow"
              @click=${() => this.selectPitchType(pType)}
            >
              ${pType}
            </button>
          `;
        })}
      </div>

      <div class="text-accent-green margin-bottom-sm">PITCH RESULTS</div>
      <div class="action-grid-3col margin-bottom-md">
        <button class="btn btn-action" @click=${() => this.triggerEvent('BALL')}>Ball (B+1)</button>
        <button class="btn btn-action" @click=${() => this.triggerEvent('STRIKE')}>Strike (S+1)</button>
        <button class="btn btn-action" @click=${() => this.triggerEvent('FOUL')}>Foul</button>
      </div>

      <div class="text-accent-green margin-bottom-sm">PLATE & IN-PLAY RESULTS</div>
      <div class="action-grid-3col margin-bottom-md">
        <button class="btn btn-action" @click=${() => this.triggerStep2('SINGLE', 'Single (1B)')}>Single (1B)</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('DOUBLE', 'Double (2B)')}>Double (2B)</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('TRIPLE', 'Triple (3B)')}>Triple (3B)</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('HOME_RUN', 'Home Run (HR)')}>Home Run (HR)</button>
        <button class="btn btn-action" @click=${() => this.triggerEvent('WALK')}>Walk (BB)</button>
        <button class="btn btn-action" @click=${() => this.triggerEvent('HIT_BY_PITCH')}>HBP</button>
        <button class="btn btn-action" @click=${() => this.triggerEvent('STRIKEOUT')}>Strikeout (K)</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('GROUNDOUT', 'Groundout')}>Groundout</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('FLYOUT', 'Flyout')}>Flyout</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('LINE_OUT', 'Line Out')}>Line Out</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('POP_OUT', 'Pop Out')}>Pop Out</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('SACRIFICE_FLY', 'Sac Fly')}>Sac Fly</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('ERROR', 'Reached on Error')}>Reached on Error</button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('FIELDER_CHOICE', "Fielder's Choice")}>Fielder's Choice</button>
      </div>

      <div class="text-accent-green margin-bottom-sm">BASE RUNNING EVENTS</div>
      <div class="action-grid-2col">
        <button class="btn btn-action" @click=${() => this.triggerStep2('STOLEN_BASE', 'Stolen Base')}>
          Stolen Base
        </button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('CAUGHT_STEALING', 'Caught Stealing')}>
          Caught Stealing
        </button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('PICKED_OFF', 'Picked Off')}>
          Picked Off
        </button>
        <button class="btn btn-action" @click=${() => this.triggerStep2('WILD_PITCH', 'WP / PB / Balk')}>
          WP / PB / Balk
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-action-grid': BaseballActionGrid;
  }
}
