import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('baseball-action-grid')
export class BaseballActionGrid extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      font-family: 'Outfit', sans-serif;
    }

    .flex-gap-sm {
      display: flex;
      gap: 0.5rem;
    }

    .flex-grow {
      flex-grow: 1;
    }

    .margin-bottom-md {
      margin-bottom: 1rem;
    }

    .margin-bottom-sm {
      margin-bottom: 0.5rem;
    }

    .margin-top-md {
      margin-top: 1rem;
    }

    .text-accent-green {
      color: var(--accent-green, #00b050);
      font-weight: bold;
      font-size: 0.85rem;
      letter-spacing: 0.5px;
    }

    .action-grid-3col {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
    }

    .action-grid-2col {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-red, #ff2a3b);
      color: #fff;
      font-weight: 700;
      padding: 0.75rem 1rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.95rem;
    }

    .btn:hover {
      background: var(--accent-red-glow, #ff5252);
      box-shadow: 0 0 12px rgba(255, 82, 82, 0.4);
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary, #f5f7fa);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: none;
      box-shadow: none;
    }

    .btn-primary {
      background: var(--accent-red, #ff2a3b);
      color: #ffffff;
      border: 1px solid var(--accent-red, #ff2a3b);
    }

    .btn-action {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-primary, #f5f7fa);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
      font-weight: 600;
    }

    .btn-action:hover {
      background: rgba(255, 42, 59, 0.15);
      border-color: var(--accent-red, #ff2a3b);
    }
  `;

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
