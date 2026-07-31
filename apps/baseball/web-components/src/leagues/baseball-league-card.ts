import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('baseball-league-card')
export class BaseballLeagueCard extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      font-family: 'Outfit', sans-serif;
      margin-bottom: 1rem;
    }

    .card {
      background: var(--bg-card, rgba(30, 36, 50, 0.45));
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color, rgba(229, 30, 43, 0.15));
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      color: var(--text-primary, #f5f7fa);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-sizing: border-box;
    }

    h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--accent-green, #00b050);
    }

    .text-muted {
      color: var(--text-secondary, #8e9cae);
    }

    .font-small {
      font-size: 0.85rem;
    }

    .margin-top-xs {
      margin-top: 0.25rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary, #f5f7fa);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
      font-weight: 700;
      padding: 0.6rem 1.2rem;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.9rem;
    }

    .btn:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  `;

  @property({ type: String, attribute: 'league-name' }) leagueName = '';
  @property({ type: String }) season = '';
  @property({ type: Number, attribute: 'team-count' }) teamCount = 0;

  render() {
    return html`
      <div class="card">
        <div>
          <h2>${this.leagueName}</h2>
          <div class="text-muted font-small margin-top-xs">Season: ${this.season} | Teams: ${this.teamCount}</div>
        </div>
        <button class="btn">Manage League</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-league-card': BaseballLeagueCard;
  }
}
