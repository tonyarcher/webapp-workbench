var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import navBarCssText from './baseball-nav-bar.css?inline';
const navBarSheet = new CSSStyleSheet();
navBarSheet.replaceSync(navBarCssText);
let BaseballNavBar = class BaseballNavBar extends LitElement {
    constructor() {
        super(...arguments);
        this.activeTab = 'leagues';
        this.userName = '';
    }
    static { this.styles = navBarSheet; }
    render() {
        return html `
            <header class="navbar">
                <div class="brand">
                    <span class="logo">⚾</span>
                    <span class="brand-name">GRAND SLAM BASEBALL</span>
                </div>

                <nav class="nav-links">
                    <button
                            class="nav-item ${this.activeTab === 'live-scorer' ? 'active' : ''}"
                            @click=${() => this.onSelectTab('live-scorer')}
                    >
                        Live Scorer
                    </button>
                    <button
                            class="nav-item ${this.activeTab === 'boxscore' ? 'active' : ''}"
                            @click=${() => this.onSelectTab('boxscore')}
                    >
                        Box Score
                    </button>
                    <button
                            class="nav-item ${this.activeTab === 'leagues' ? 'active' : ''}"
                            @click=${() => this.onSelectTab('leagues')}
                    >
                        Leagues
                    </button>
                    <button
                            class="nav-item ${this.activeTab === 'teams' ? 'active' : ''}"
                            @click=${() => this.onSelectTab('teams')}
                    >
                        Teams
                    </button>
                    <button
                            class="nav-item ${this.activeTab === 'games' ? 'active' : ''}"
                            @click=${() => this.onSelectTab('games')}
                    >
                        Dashboard
                    </button>
                    <button
                            class="nav-item ${this.activeTab === 'stats' ? 'active' : ''}"
                            @click=${() => this.onSelectTab('stats')}
                    >
                        Stats
                    </button>
                </nav>

                <div class="auth-status">
                    ${this.userName
            ? html `<span class="user-greeting">👤 ${this.userName}</span>`
            : html `
                                <button
                                        class="nav-item auth-btn ${this.activeTab === 'login' ? 'active' : ''}"
                                        @click=${() => this.onSelectTab('login')}
                                >
                                    Sign In
                                </button>
                            `}
                </div>
            </header>
        `;
    }
    onSelectTab(tabId) {
        this.dispatchEvent(new CustomEvent('tab-selected', {
            detail: { tabId },
            bubbles: true
        }));
    }
};
__decorate([
    property({ type: String, attribute: 'active-tab' })
], BaseballNavBar.prototype, "activeTab", void 0);
__decorate([
    property({ type: String, attribute: 'user-name' })
], BaseballNavBar.prototype, "userName", void 0);
BaseballNavBar = __decorate([
    customElement('baseball-nav-bar')
], BaseballNavBar);
export { BaseballNavBar };
