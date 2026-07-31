import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('baseball-scoreboard')
export class BaseballScoreboard extends LitElement {
  // Disable Shadow DOM to seamlessly use host CSS rules & custom properties
  protected createRenderRoot() {
    return this;
  }

  @property({ type: String, attribute: 'away-name' }) awayName = 'AWAY';
  @property({ type: String, attribute: 'home-name' }) homeName = 'HOME';
  @property({ type: Number, attribute: 'away-score' }) awayScore = 0;
  @property({ type: Number, attribute: 'home-score' }) homeScore = 0;
  @property({ type: Number, attribute: 'away-hits' }) awayHits = 0;
  @property({ type: Number, attribute: 'home-hits' }) homeHits = 0;
  @property({ type: Number, attribute: 'away-errors' }) awayErrors = 0;
  @property({ type: Number, attribute: 'home-errors' }) homeErrors = 0;

  @property({ type: Number }) inning = 1;
  @property({ type: String }) half = 'TOP'; // TOP or BOTTOM
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
