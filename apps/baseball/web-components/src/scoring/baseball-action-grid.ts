import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

@customElement('baseball-action-grid')
export class BaseballActionGrid extends LitElement {
  protected createRenderRoot() {
    return this;
  }

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

      <div class="text-accent-green font-bold margin-bottom-sm">PITCH RESULTS</div>
      <div class="action-grid-3col">
        <button class="btn btn-secondary btn-action" @click=${() => this.triggerEvent('BALL')}>Ball (B+1)</button>
        <button class="btn btn-secondary btn-action" @click=${() => this.triggerEvent('STRIKE')}>Strike (S+1)</button>
        <button class="btn btn-secondary btn-action" @click=${() => this.triggerEvent('FOUL')}>Foul</button>
      </div>

      <div class="text-accent-green font-bold margin-top-md margin-bottom-sm">BASE RUNNING EVENTS</div>
      <div class="action-grid-2col">
        <button class="btn btn-secondary btn-action" @click=${() => this.triggerStep2('STOLEN_BASE', 'Stolen Base')}>
          Stolen Base
        </button>
        <button class="btn btn-secondary btn-action" @click=${() => this.triggerStep2('CAUGHT_STEALING', 'Caught Stealing')}>
          Caught Stealing
        </button>
        <button class="btn btn-secondary btn-action" @click=${() => this.triggerStep2('PICKED_OFF', 'Picked Off')}>
          Picked Off
        </button>
        <button class="btn btn-secondary btn-action" @click=${() => this.triggerStep2('WILD_PITCH', 'WP / PB / Balk')}>
          WP / PB / Balk
        </button>
      </div>
    `;
  }
}
