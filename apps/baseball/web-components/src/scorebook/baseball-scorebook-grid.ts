import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import scorebookCssText from './baseball-scorebook-grid/baseball-scorebook-grid.css?inline';

const scorebookSheet = new CSSStyleSheet();
scorebookSheet.replaceSync(scorebookCssText);

export interface InningSlotData {
  b1?: boolean;
  b2?: boolean;
  b3?: boolean;
  b4?: boolean;
  playDesc?: string;
  outs?: number;
  endedInning?: boolean;
}

export interface ScorebookRowData {
  battingSlot: number;
  playersInSlot: string[];
  slots: (InningSlotData | null)[];
}

@customElement('baseball-scorebook-grid')
export class BaseballScorebookGrid extends LitElement {
  static styles = scorebookSheet;

  @property({type: String, attribute: 'team-name'}) teamName = 'Team Scorecard';
  @property({ type: Number, attribute: 'max-inning' }) maxInning = 9;
  @property({type: Array}) rows: ScorebookRowData[] = [];

  @property({
    type: String,
    attribute: 'slots-json',
    converter: {
      fromAttribute: (val: string | null) => {
        if (!val) return [];
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
    }
  })
  set slotsJson(val: ScorebookRowData[]) {
    this.rows = val;
  }

  render() {
    const inningsArray = Array.from({length: this.maxInning}, (_, i) => i + 1);

    return html`
      <div class="card scorebook-container">
        <h2 class="scorebook-title">${this.teamName} - Scorebook Sheet</h2>

        <div class="table-wrapper">
          <table class="scorebook-table">
            <thead>
              <tr>
                <th class="col-slot">#</th>
                <th class="col-name">Batter Name</th>
                ${inningsArray.map((inn) => html`<th class="col-inning">${inn}</th>`)}
              </tr>
            </thead>
            <tbody>
            ${this.rows.map(
                (row) => html`
                  <tr>
                    <td class="col-slot font-bold">${row.battingSlot}</td>
                    <td class="col-name">
                      <div class="player-names-list">
                        ${row.playersInSlot.map((name) => html`<div>${name}</div>`)}
                      </div>
                    </td>
                    ${inningsArray.map((_, idx) => html`
                      <td class="col-inning">
                        ${this.renderDiamond(row.slots[idx] || null)}
                      </td>
                    `)}
                  </tr>
                `
            )}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  private renderDiamond(slot: InningSlotData | null) {
    if (!slot) {
      return html`
        <div class="diamond"></div>`;
    }

    const b1Class = slot.b1 ? 'b1' : '';
    const b2Class = slot.b2 ? 'b2' : '';
    const b3Class = slot.b3 ? 'b3' : '';
    const b4Class = slot.b4 ? 'b4' : '';
    const endClass = slot.endedInning ? 'ended-inning' : '';

    return html`
      <div class="diamond ${b1Class} ${b2Class} ${b3Class} ${b4Class} ${endClass}">
        ${slot.playDesc ? html`<div class="play-desc">${slot.playDesc}</div>` : ''}
        ${slot.outs !== undefined && slot.outs > 0
        ? html`<div class="out-circle">${slot.outs}</div>`
        : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-scorebook-grid': BaseballScorebookGrid;
  }
}
