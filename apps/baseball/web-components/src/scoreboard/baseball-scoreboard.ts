import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('baseball-scoreboard')
export class BaseballScoreboard extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .scoreboard-led {
      background: linear-gradient(135deg, #0b0d13 0%, #161a24 100%);
      border: 2px solid var(--border-color, rgba(229, 30, 43, 0.15));
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 15px rgba(0, 0, 0, 0.6);
      color: var(--text-primary, #f5f7fa);
      font-family: 'Outfit', sans-serif;
    }

    .scoreboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 0.75rem;
      margin-bottom: 1rem;
    }

    .inning-display {
      font-size: 1.1rem;
      font-weight: 800;
      color: var(--accent-red, #ff2a3b);
      letter-spacing: 1px;
    }

    .outs-indicator {
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--accent-yellow, #ffcc00);
      background: rgba(255, 204, 0, 0.1);
      border: 1px solid rgba(255, 204, 0, 0.3);
      padding: 0.2rem 0.6rem;
      border-radius: 6px;
    }

    .scoreboard-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .team-led-name {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: 1px;
    }

    .team-led-score {
      font-family: 'Share Tech Mono', monospace;
      font-size: 2rem;
      font-weight: 900;
      color: var(--accent-yellow, #ffcc00);
      text-shadow: 0 0 10px rgba(255, 204, 0, 0.4);
    }

    .count-display {
      font-family: 'Share Tech Mono', monospace;
      font-size: 1rem;
      font-weight: 700;
      color: var(--accent-green-glow, #00e676);
    }

    .diamond-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 1.5rem 0;
    }

    .base-diamond {
      position: relative;
      width: 70px;
      height: 70px;
      transform: rotate(45deg);
      border: 2px solid rgba(255, 255, 255, 0.15);
      background: rgba(0, 0, 0, 0.2);
    }

    .base {
      position: absolute;
      width: 22px;
      height: 22px;
      background: rgba(255, 255, 255, 0.1);
      border: 1.5px solid rgba(255, 255, 255, 0.3);
      transition: all 0.3s ease;
    }

    .base.occupied {
      background: var(--accent-red, #ff2a3b);
      border-color: #ffffff;
      box-shadow: 0 0 12px var(--accent-red-glow, #ff5252);
    }

    .base-first { top: -2px; right: -2px; }
    .base-second { top: -2px; left: -2px; }
    .base-third { bottom: -2px; left: -2px; }
    .base-home { bottom: -2px; right: -2px; background: transparent; border: none; }

    .base-label {
      transform: rotate(-45deg);
      font-size: 0.55rem;
      font-weight: 800;
      text-align: center;
      line-height: 20px;
      color: #ffffff;
    }

    .text-muted {
      color: var(--text-secondary, #8e9cae);
    }

    .font-small {
      font-size: 0.85rem;
    }

    .margin-top-md {
      margin-top: 1rem;
    }

    .border-top-dark {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .padding-top-sm {
      padding-top: 0.5rem;
    }
  `;

  @property({ type: String, attribute: 'away-name' }) awayName = 'AWAY';
  @property({ type: String, attribute: 'home-name' }) homeName = 'HOME';
  @property({ type: Number, attribute: 'away-score' }) awayScore = 0;
  @property({ type: Number, attribute: 'home-score' }) homeScore = 0;
  @property({ type: Number, attribute: 'away-hits' }) awayHits = 0;
  @property({ type: Number, attribute: 'home-hits' }) homeHits = 0;
  @property({ type: Number, attribute: 'away-errors' }) awayErrors = 0;
  @property({ type: Number, attribute: 'home-errors' }) homeErrors = 0;

  @property({ type: Number }) inning = 1;
  @property({ type: String }) half = 'TOP';
  @property({ type: Number }) balls = 0;
  @property({ type: Number }) strikes = 0;
  @property({ type: Number }) outs = 0;

  @property({ type: Boolean, attribute: 'runner-first' }) runnerFirst = false;
  @property({ type: Boolean, attribute: 'runner-second' }) runnerSecond = false;
  @property({ type: Boolean, attribute: 'runner-third' }) runnerThird = false;

  @property({ type: String, attribute: 'runner-first-name' }) runnerFirstName = '';
  @property({ type: String, attribute: 'runner-second-name' }) runnerSecondName = '';
  @property({ type: String, attribute: 'runner-third-name' }) runnerThirdName = '';

  render() {
    const inningSymbol = this.half === 'TOP' ? '▲' : '▼';
    const outsStr = this.outs === 0 ? 'No Outs' : this.outs === 1 ? '1 Out' : this.outs === 2 ? '2 Outs' : '3 Outs';

    return html`
      <div class="scoreboard-led">
        <div class="scoreboard-header">
          <span class="inning-display">${inningSymbol} Inning ${this.inning}</span>
          <span class="outs-indicator">${outsStr}</span>
        </div>

        <div class="scoreboard-row">
          <span class="team-led-name">${this.awayName}</span>
          <span class="team-led-score">${this.awayScore}</span>
        </div>

        <div class="scoreboard-row">
          <span class="team-led-name">${this.homeName}</span>
          <span class="team-led-score">${this.homeScore}</span>
        </div>

        <div class="scoreboard-row margin-top-md">
          <span class="count-display">Count: ${this.balls} - ${this.strikes}</span>
          <span class="text-muted font-small">
            R-H-E: ${this.awayScore}-${this.awayHits}-${this.awayErrors} vs ${this.homeScore}-${this.homeHits}-${this.homeErrors}
          </span>
        </div>

        <div class="diamond-container">
          <div class="base-diamond">
            <div class="base base-first ${this.runnerFirst ? 'occupied' : ''}">
              <div class="base-label">1st</div>
            </div>
            <div class="base base-second ${this.runnerSecond ? 'occupied' : ''}">
              <div class="base-label">2nd</div>
            </div>
            <div class="base base-third ${this.runnerThird ? 'occupied' : ''}">
              <div class="base-label">3rd</div>
            </div>
            <div class="base base-home"></div>
          </div>
        </div>

        <div class="text-muted font-small margin-top-md border-top-dark padding-top-sm">
          ${this.runnerFirstName ? html`<div>1B: ${this.runnerFirstName}</div>` : ''}
          ${this.runnerSecondName ? html`<div>2B: ${this.runnerSecondName}</div>` : ''}
          ${this.runnerThirdName ? html`<div>3B: ${this.runnerThirdName}</div>` : ''}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-scoreboard': BaseballScoreboard;
  }
}
