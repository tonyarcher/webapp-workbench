import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import step2CssText from './baseball-step2-panel.css?inline';

const step2Sheet = new CSSStyleSheet();
step2Sheet.replaceSync(step2CssText);

@customElement('baseball-step2-panel')
export class BaseballStep2Panel extends LitElement {
    static styles = step2Sheet;

    @property({type: String, attribute: 'base-label'}) baseLabel = '';
    @property({type: Boolean, attribute: 'is-hit'}) isHit = false;

    private get locations(): string[] {
        return this.isHit
            ? ['Left Field', 'Center Field', 'Right Field', 'Infield', 'Down the Line', 'Gap']
            : [
                'Pitcher (1)', 'Catcher (2)', '1st Base (3)', '2nd Base (4)', '3rd Base (5)',
                'Shortstop (6)', 'Left Field (7)', 'Center Field (8)', 'Right Field (9)',
            ];
    }

    render() {
        return html`
            <div class="step2-card">
                <h3 class="step2-title">Step 2: ${this.baseLabel} Details</h3>
                <div class="location-grid">
                    ${this.locations.map(loc => html`
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

    private selectLocation(location: string | null) {
        this.dispatchEvent(new CustomEvent('location-selected', {
            detail: {location},
            bubbles: true,
            composed: true,
        }));
    }

    private cancelStep2() {
        this.dispatchEvent(new CustomEvent('cancel-step2', {
            bubbles: true,
            composed: true,
        }));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-step2-panel': BaseballStep2Panel;
    }
}
