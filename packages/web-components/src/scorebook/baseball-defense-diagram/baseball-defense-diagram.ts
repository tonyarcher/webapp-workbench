import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import defenseCssText from './baseball-defense-diagram.css?inline';

const defenseSheet = new CSSStyleSheet();
defenseSheet.replaceSync(defenseCssText);

export interface FielderPosition {
    posNum: number;
    posName: string;
    playerName: string;
    jerseyNumber: number;
    topPct: number;
    leftPct: number;
}

@customElement('baseball-defense-diagram')
export class BaseballDefenseDiagram extends LitElement {
    static styles = defenseSheet;

    @property({type: String, attribute: 'defending-team'}) defendingTeam = 'Defending Team';
    @property({type: Array}) fielders: FielderPosition[] = [];

    render() {
        return html`
      <div class="card">
        <h2>Defensive Alignment - ${this.defendingTeam}</h2>
        <div class="field-container">
          ${this.renderFieldLines()}
          ${this.renderFielders()}
        </div>
      </div>
    `;
    }

    private renderFieldLines() {
        return html`
          <div class="foul-line-left"></div>
          <div class="foul-line-right"></div>
          <div class="infield-diamond">
            <div class="field-base f-home"></div>
            <div class="field-base f-first"></div>
            <div class="field-base f-second"></div>
            <div class="field-base f-third"></div>
          </div>
          <div class="pitcher-mound"></div>
        `;
    }

    private renderFielders() {
        return html`${this.fielders.map((f) => this.renderFielder(f))}`;
    }

    private renderFielder(f: FielderPosition) {
        return html`
          <div class="fielder-node" style="top: ${f.topPct}%; left: ${f.leftPct}%;">
            <div class="pos-badge-icon">${f.posNum}</div>
            <div class="fielder-info">
              <span class="player-name">${f.playerName}</span>
              <span class="pos-code">#${f.jerseyNumber} ${f.posName}</span>
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
