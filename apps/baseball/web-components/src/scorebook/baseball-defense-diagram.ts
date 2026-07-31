import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface Fielder {
  position: string;
  name: string;
}

@customElement('baseball-defense-diagram')
export class BaseballDefenseDiagram extends LitElement {
  static styles = css`
    :host {
      display: block;
      flex: 1 1 280px;
      max-width: 100%;
      box-sizing: border-box;
      font-family: 'Courier New', Courier, monospace;
    }

    .field-diagram-card {
      background-color: #faf9f6;
      border: 2px solid #5a544a;
      color: #2b2a28;
      border-radius: 8px;
      padding: 1rem;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      box-sizing: border-box;
    }

    h3 {
      color: #1a1918;
      font-size: 1.1rem;
      font-weight: bold;
      border-bottom: 2px solid #5a544a;
      padding-bottom: 0.5rem;
      margin: 0 0 1rem 0;
    }

    .field-diagram-wrapper {
      position: relative;
      width: 100%;
      height: 240px;
      background-color: #2e7d32;
      border: 2px solid #5a544a;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 0.5rem;
    }

    #field-diamond-bg {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 120px;
      height: 120px;
      margin-top: -60px;
      margin-left: -60px;
      border: 2px solid rgba(255, 255, 255, 0.6);
      transform: rotate(45deg);
      background: rgba(210, 180, 140, 0.35);
    }

    .field-position-badge {
      background-color: #ffffff;
      border: 1px solid #5a544a;
      color: #111111;
      font-size: 0.7rem;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      z-index: 10;
    }

    .pos-pos-P { position: absolute; left: 50%; top: 55%; transform: translate(-50%, -50%); }
    .pos-pos-C { position: absolute; left: 50%; top: 85%; transform: translate(-50%, -50%); }
    .pos-pos-1B { position: absolute; left: 72%; top: 52%; transform: translate(-50%, -50%); }
    .pos-pos-2B { position: absolute; left: 60%; top: 38%; transform: translate(-50%, -50%); }
    .pos-pos-3B { position: absolute; left: 28%; top: 52%; transform: translate(-50%, -50%); }
    .pos-pos-SS { position: absolute; left: 40%; top: 38%; transform: translate(-50%, -50%); }
    .pos-pos-LF { position: absolute; left: 20%; top: 22%; transform: translate(-50%, -50%); }
    .pos-pos-CF { position: absolute; left: 50%; top: 15%; transform: translate(-50%, -50%); }
    .pos-pos-RF { position: absolute; left: 80%; top: 22%; transform: translate(-50%, -50%); }
  `;

  @property({ type: Array }) fielders: Fielder[] = [];

  @property({
    type: String,
    attribute: 'fielders-json',
    converter: {
      fromAttribute: (value: string | null) => {
        if (!value) return [];
        try {
          return JSON.parse(value);
        } catch {
          return [];
        }
      }
    }
  })
  set fieldersJson(val: Fielder[]) {
    this.fielders = val;
  }

  render() {
    const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

    return html`
      <div class="field-diagram-card">
        <h3>DEFENSIVE POSITIONS</h3>
        <div class="field-diagram-wrapper">
          <div id="field-diamond-bg"></div>
          ${positions.map((posCode) => {
            const valFielder = this.fielders.find((f) => f.position === posCode);
            const pName = valFielder ? valFielder.name : posCode;
            return html`
              <div class="field-position-badge pos-pos-${posCode}">
                <span>${posCode}: ${pName}</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-defense-diagram': BaseballDefenseDiagram;
  }
}
