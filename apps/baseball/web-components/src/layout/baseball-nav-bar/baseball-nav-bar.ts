import { html, css, unsafeCSS, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import navCss from './baseball-nav-bar.css?inline';

export interface NavTabItem {
  id: string;
  label: string;
}

@customElement('baseball-nav-bar')
export class BaseballNavBar extends LitElement {
  static styles = css`${unsafeCSS(navCss)}`;

  @property({ type: String, attribute: 'active-tab' }) activeTab = 'dashboard';
  @property({ type: String, attribute: 'user-name' }) userName = '';

  private readonly tabs: NavTabItem[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'scorer', label: 'Scorer' },
    { id: 'boxscore', label: 'Box Score' },
    { id: 'stats', label: 'Stats' },
    { id: 'teams', label: 'Teams' },
    { id: 'leagues', label: 'Leagues' }
  ];

  private onTabClick(tabId: string) {
    this.dispatchEvent(
      new CustomEvent('tab-selected', {
        detail: { tabId },
        bubbles: true
      })
    );
  }

  render() {
    return html`
      <nav class="nav-container">
        <div class="brand">
          <span>⚾ BASEBALL</span>
          <span class="brand-badge">PRO</span>
        </div>

        <div class="nav-tabs">
          ${this.tabs.map(
            (t) => html`
              <button
                class="nav-tab ${this.activeTab === t.id ? 'active' : ''}"
                @click=${() => this.onTabClick(t.id)}
              >
                ${t.label}
              </button>
            `
          )}
          <button
            class="nav-tab ${this.activeTab === 'auth' ? 'active' : ''}"
            @click=${() => this.onTabClick('auth')}
          >
            ${this.userName ? `👤 ${this.userName}` : '🔑 Login'}
          </button>
        </div>
      </nav>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-nav-bar': BaseballNavBar;
  }
}
