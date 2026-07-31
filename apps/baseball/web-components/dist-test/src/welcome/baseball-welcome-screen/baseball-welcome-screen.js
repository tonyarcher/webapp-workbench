var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import welcomeCssText from './baseball-welcome-screen.css?inline';
const welcomeSheet = new CSSStyleSheet();
welcomeSheet.replaceSync(welcomeCssText);
let BaseballWelcomeScreen = class BaseballWelcomeScreen extends LitElement {
    constructor() {
        super(...arguments);
        this.serverOnline = true;
    }
    static { this.styles = welcomeSheet; }
    render() {
        return html `
            <div class="welcome-container">
                <h1>⚾ GRAND SLAM BASEBALL</h1>
                <p class="subtitle">Exhibition Mode (Offline) & Full League Season Mode (Online)</p>

                <div class="mode-grid">
                    <div class="mode-card" @click=${() => this.onSelectMode('single')}>
                        <div>
                            <div class="mode-icon">⚾</div>
                            <div class="mode-title">Single Game Mode</div>
                            <div class="mode-desc">
                                Play or score a local exhibition game between Chicago and St. Louis.
                                Runs entirely in your browser with zero server dependency.
                            </div>
                        </div>
                        <div>
                            <span class="badge badge-offline">CLIENT-SIDE ONLY</span>
                        </div>
                    </div>

                    <div class="mode-card" @click=${() => this.onSelectMode('league')}>
                        <div>
                            <div class="mode-icon">🏆</div>
                            <div class="mode-title">League & Season Mode</div>
                            <div class="mode-desc">
                                Manage complete baseball leagues, schedule round-robin seasons,
                                track standings, and record live games backed by your database server.
                            </div>
                        </div>
                        <div>
              <span class="badge ${this.serverOnline ? 'badge-online' : 'badge-offline'}">
                ${this.serverOnline ? 'SERVER ONLINE' : 'CHECK CONNECTION'}
              </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    onSelectMode(mode) {
        this.dispatchEvent(new CustomEvent('mode-selected', {
            detail: { mode },
            bubbles: true
        }));
    }
};
__decorate([
    property({ type: Boolean, attribute: 'server-online' })
], BaseballWelcomeScreen.prototype, "serverOnline", void 0);
BaseballWelcomeScreen = __decorate([
    customElement('baseball-welcome-screen')
], BaseballWelcomeScreen);
export { BaseballWelcomeScreen };
