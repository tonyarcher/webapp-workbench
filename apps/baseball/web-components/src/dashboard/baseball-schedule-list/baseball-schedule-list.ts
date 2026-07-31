import {html, LitElement} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import scheduleCssText from './baseball-schedule-list.css?inline';

const scheduleSheet = new CSSStyleSheet();
scheduleSheet.replaceSync(scheduleCssText);

export interface GameItem {
  id: number;
  awayTeam: string;
  homeTeam: string;
  awayScore: number;
  homeScore: number;
  date: string;
  status: string;
}

@customElement('baseball-schedule-list')
export class BaseballScheduleList extends LitElement {
  static styles = scheduleSheet;

  @property({ type: Array }) games: GameItem[] = [];

  @property({
    type: String,
    attribute: 'games-json',
    converter: {
      fromAttribute: (val: string | null) => {
        if (!val) return [];
        try {
          return JSON.parse(val);
        } catch {
          return [];
        }
      }
    }
  })
  set gamesJson(val: GameItem[]) {
    this.games = val;
  }

  private onScoreGame(gameId: number) {
    this.dispatchEvent(new CustomEvent('score-game-click', { detail: { gameId }, bubbles: true }));
  }

  private onBoxScore(gameId: number) {
    this.dispatchEvent(new CustomEvent('box-score-click', { detail: { gameId }, bubbles: true }));
  }

  render() {
    return html`
      <div class="card">
        <h3>Games Schedule (${this.games.length})</h3>
        ${this.games.length === 0
          ? html`<p class="text-muted">No games scheduled yet.</p>`
          : html`
              <div class="schedule-list">
                ${this.games.map(
                  (g) => html`
                    <div class="game-card">
                      <div>
                        <div class="font-bold">${g.awayTeam} @ ${g.homeTeam}</div>
                        <div class="text-muted font-small margin-top-xs">Date: ${g.date} | Status: ${g.status}</div>
                      </div>
                      <div class="flex-center flex-gap-sm">
                        ${g.status === 'COMPLETED'
                          ? html`
                              <span class="font-bold margin-right-md">${g.awayScore} - ${g.homeScore}</span>
                              <button class="btn btn-secondary" @click=${() => this.onBoxScore(g.id)}>Box Score</button>
                            `
                          : html`
                              <button class="btn" @click=${() => this.onScoreGame(g.id)}>Score Game</button>
                            `}
                      </div>
                    </div>
                  `
                )}
              </div>
            `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'baseball-schedule-list': BaseballScheduleList;
  }
}
