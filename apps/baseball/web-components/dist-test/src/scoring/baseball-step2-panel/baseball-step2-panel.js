var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import step2CssText from './baseball-step2-panel.css?inline';
const step2Sheet = new CSSStyleSheet();
step2Sheet.replaceSync(step2CssText);
let BaseballStep2Panel = class BaseballStep2Panel extends LitElement {
    constructor() {
        super(...arguments);
        this.baseLabel = '';
        this.isHit = false;
    }
    static { this.styles = step2Sheet; }
    get locations() {
        return this.isHit
            ? ['Left Field', 'Center Field', 'Right Field', 'Infield', 'Down the Line', 'Gap']
            : [
                'Pitcher (1)', 'Catcher (2)', '1st Base (3)', '2nd Base (4)', '3rd Base (5)',
                'Shortstop (6)', 'Left Field (7)', 'Center Field (8)', 'Right Field (9)',
            ];
    }
    render() {
        return html `
            <div class="step2-card">
                <h3 class="step2-title">Step 2: ${this.baseLabel} Details</h3>
                <div class="location-grid">
                    ${this.locations.map(loc => html `
                        <button class="btn btn-action" @click=${() => this.selectLocation(loc)}>
                            ${loc}
                        </button>
                    `)}
                    <button class="btn btn-action" @click=${() => this.selectLocation(null)}>
                        Unspecified Location
                    </button>
                </div>
                <button class="btn btn-secondary" @click=${() => this.cancelStep2()}>
                    ← Cancel
                </button>
            </div>
        `;
    }
    selectLocation(location) {
        this.dispatchEvent(new CustomEvent('location-selected', {
            detail: { location },
            bubbles: true,
            composed: true,
        }));
    }
    cancelStep2() {
        this.dispatchEvent(new CustomEvent('cancel-step2', {
            bubbles: true,
            composed: true,
        }));
    }
};
__decorate([
    property({ type: String, attribute: 'base-label' })
], BaseballStep2Panel.prototype, "baseLabel", void 0);
__decorate([
    property({ type: Boolean, attribute: 'is-hit' })
], BaseballStep2Panel.prototype, "isHit", void 0);
BaseballStep2Panel = __decorate([
    customElement('baseball-step2-panel')
], BaseballStep2Panel);
export { BaseballStep2Panel };
