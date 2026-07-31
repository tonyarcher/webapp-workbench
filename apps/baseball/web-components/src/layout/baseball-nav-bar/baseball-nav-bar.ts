import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import navBarCssText from './baseball-nav-bar.css?inline';

const navBarSheet = new CSSStyleSheet();
navBarSheet.replaceSync(navBarCssText);

@customElement('baseball-nav-bar')
export class BaseballNavBar extends LitElement {
    static styles = navBarSheet;

    @property({type: String, attribute: 'active-tab'}) activeTab = 'leagues';
    @property({type: String, attribute: 'user-name'}) userName = '';
    @property({type: Boolean, attribute: 'is-single-game-mode'}) isSingleGameMode = false;

    render() {
        return html`
            <header class="navbar">
                <div class="brand" @click=${() => this.onSelectTab('welcome')} style="cursor: pointer;">
                    <span class="logo">⚾</span>
                    <span class="brand-name">GRAND SLAM BASEBALL</span>
                </div>

                <nav class="nav-links">
                    ${this.isSingleGameMode ? html`
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
                                class="nav-item"
                                @click=${() => this.onSelectTab('leagues')}
                        >
                            League Menu
                        </button>
                        <button
                                class="nav-item"
                                @click=${() => this.onSelectTab('welcome')}
                        >
                            Main Menu
                        </button>
                    ` : html`
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
                    `}
                </nav>

                <div class="auth-section">
                    ${this.userName ? html`
                        <span class="user-greeting">Hi, ${this.userName}</span>
                        <button class="btn btn-sm btn-secondary" @click=${this.onLogout}>Sign Out</button>
                    ` : html`
                        <button class="btn btn-sm btn-outline" @click=${() => this.onSelectTab('login')}>Sign In</button>
                        <button class="btn btn-sm btn-primary" @click=${() => this.onSelectTab('register')}>Register</button>
                    `}
                </div>
            </header>
        `;
    }

    private onSelectTab(tabId: string) {
        this.activeTab = tabId;
        this.setAttribute('active-tab', tabId);
        this.dispatchEvent(
            new CustomEvent('tab-selected', {
                detail: {tabId},
                bubbles: true,
                composed: true
            })
        );
    }

    private onLogout() {
        this.dispatchEvent(new CustomEvent('auth-logout', {bubbles: true, composed: true}));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'baseball-nav-bar': BaseballNavBar;
    }
}
