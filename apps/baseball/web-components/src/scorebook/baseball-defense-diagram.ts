import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';

export interface Fielder {
  position: string;
  name: string;
}

@customElement('baseball-defense-diagram')
export class BaseballDefenseDiagram extends LitElement {
  protected createRenderRoot() {
    return this;
  }

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
      <div class="field-diagram-card card">
        <h3>DEFENSIVE POSITIONS</h3>
        <div class="field-diagram-wrapper">
          <div id="field-diamond-bg"></div>
          ${positions.map((posCode) => {
            const valFielder = this.fielders.find((f) => f.position === posCode);
            const pName = valFielder ? valFielder.name : posCode;
            return html`
              <div class="field-position-badge pos-pos-${posCode}">
                <span class="font-bold">${posCode}: ${pName}</span>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }
}
