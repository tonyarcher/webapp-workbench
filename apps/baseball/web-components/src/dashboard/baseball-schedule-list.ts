import { html, css, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

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
  static styles = css`
    :host {
      display: block;
      width: 100%;
      font-family: 'Outfit', sans-serif;
    }

    .card {
      background: var(--bg-card, rgba(30, 36, 50, 0.45));
      backdrop-filter: blur(12px);
      border: 1px solid var(--border-color, rgba(229, 30, 43, 0.15));
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
      color: var(--text-primary, #f5f7fa);
    }

    h3 {
      margin-top: 0;
      margin-bottom: 1rem;
      font-size: 1.25rem;
      font-weight: 700;
    }

    .schedule-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .game-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem;
      background: rgba(20, 30, 25, 0.3);
      border: 1px solid var(--border-color, rgba(229, 30, 43, 0.15));
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    .game-card:hover {
      background: rgba(255, 42, 59, 0.05);
      border-color: rgba(255, 42, 59, 0.6);
    }

    .font-bold {
      font-weight: 700;
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

    .flex-center {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .flex-gap-sm {
      gap: 0.5rem;
    }

    .margin-right-md {
      margin-right: 1rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-red, #ff2a3b);
      color: #fff;
      font-weight: 700;
      padding: 0.6rem 1.2rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 0.9rem;
    }

    .btn:hover {
      background: var(--accent-red-glow, #ff5252);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-primary, #f5f7fa);
      border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  `;

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
