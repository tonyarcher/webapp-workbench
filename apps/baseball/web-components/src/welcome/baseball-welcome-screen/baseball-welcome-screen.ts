import { html, css, unsafeCSS, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import welcomeCss from './baseball-welcome-screen.css?inline';

@customElement('baseball-welcome-screen')
export class BaseballWelcomeScreen extends LitElement {
  static styles = css`${unsafeCSS(welcomeCss)}`;

  @property({ type: Boolean, attribute: 'server-online' }) serverOnline = true;

  private onSelectMode(mode: 'single' | 'league') {
    this.dispatchEvent(
      new CustomEvent('mode-selected', {
        detail: { mode },
        bubbles: true
      })
    );
  }

  render() {
    return html`
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
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-welcome-screen': BaseballWelcomeScreen;
  }
}
