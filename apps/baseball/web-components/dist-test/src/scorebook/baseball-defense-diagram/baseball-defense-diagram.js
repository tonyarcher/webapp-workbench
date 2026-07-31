var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import defenseCssText from './baseball-defense-diagram.css?inline';
const defenseSheet = new CSSStyleSheet();
defenseSheet.replaceSync(defenseCssText);
let BaseballDefenseDiagram = class BaseballDefenseDiagram extends LitElement {
    constructor() {
        super(...arguments);
        this.defendingTeam = 'Defending Team';
        this.fielders = [];
    }
    static { this.styles = defenseSheet; }
    render() {
        return html `
      <div class="card">
        <h2>Defensive Alignment - ${this.defendingTeam}</h2>

        <div class="field-container">
          <div class="foul-line-left"></div>
          <div class="foul-line-right"></div>

          <div class="infield-diamond">
            <div class="field-base f-home"></div>
            <div class="field-base f-first"></div>
            <div class="field-base f-second"></div>
            <div class="field-base f-third"></div>
          </div>

          <div class="pitcher-mound"></div>

          ${this.fielders.map((f) => html `
                <div
                    class="fielder-node"
                    style="top: ${f.topPct}%; left: ${f.leftPct}%;"
                >
                  <div class="pos-badge-icon">${f.posNum}</div>
                  <div class="fielder-info">
                    <span class="player-name">${f.playerName}</span>
                    <span class="pos-code">#${f.jerseyNumber} ${f.posName}</span>
                  </div>
                </div>
              `)}
        </div>
      </div>
    `;
    }
};
__decorate([
    property({ type: String, attribute: 'defending-team' })
], BaseballDefenseDiagram.prototype, "defendingTeam", void 0);
__decorate([
    property({ type: Array })
], BaseballDefenseDiagram.prototype, "fielders", void 0);
BaseballDefenseDiagram = __decorate([
    customElement('baseball-defense-diagram')
], BaseballDefenseDiagram);
export { BaseballDefenseDiagram };
