import { LitElement, html } from 'lit';
import { DEFAULT_GAME_SETUP } from './game-types';
import type { LineupPlayer, LocalGameSetup } from './game-types';
import {
  DEFAULT_AWAY_LINEUP,
  DEFAULT_AWAY_PITCHER,
  DEFAULT_HOME_LINEUP,
  DEFAULT_HOME_PITCHER,
  toLineupPlayers,
} from './default-lineups';

interface EditorPlayer {
  name?: string;
  batterName?: string;
  position?: string;
  jerseyNumber?: number;
}

interface LineupDraftDetail {
  homeLineup?: EditorPlayer[];
  awayLineup?: EditorPlayer[];
  homePitcherName?: string;
  awayPitcherName?: string;
}

function toEditorJson(players: LineupPlayer[]): string {
  return JSON.stringify(
    players.map((player, index) => ({
      id: index + 1,
      name: player.batterName,
      jerseyNumber: player.jerseyNumber ?? 0,
      position: player.position,
    }))
  );
}

function fromEditorPlayers(players: EditorPlayer[] | undefined, fallback: LineupPlayer[]): LineupPlayer[] {
  if (!players || players.length === 0) return fallback;
  return players.slice(0, 9).map((player, index) => mapEditorPlayer(player, fallback[index], index));
}

function mapEditorPlayer(player: EditorPlayer, fallback: LineupPlayer | undefined, index: number): LineupPlayer {
  return {
    batterName: resolveBatterName(player, fallback, index),
    position: resolvePosition(player, fallback),
    jerseyNumber: resolveJersey(player, fallback),
  };
}

function resolveBatterName(player: EditorPlayer, fallback: LineupPlayer | undefined, index: number): string {
  const raw = String(player.batterName ?? player.name ?? '').trim();
  if (raw) return raw;
  if (fallback?.batterName) return fallback.batterName;
  return `Batter ${index + 1}`;
}

function resolvePosition(player: EditorPlayer, fallback: LineupPlayer | undefined): string {
  const raw = String(player.position ?? fallback?.position ?? 'DH').trim();
  return raw || 'DH';
}

function resolveJersey(player: EditorPlayer, fallback: LineupPlayer | undefined): number {
  return Number(player.jerseyNumber ?? fallback?.jerseyNumber ?? 0);
}

export class BaseballSetupScreen extends LitElement {
  createRenderRoot() {
    return this;
  }

  private pendingHomeLineup = toLineupPlayers(DEFAULT_HOME_LINEUP);
  private pendingAwayLineup = toLineupPlayers(DEFAULT_AWAY_LINEUP);
  private pendingHomePitcher = DEFAULT_HOME_PITCHER;
  private pendingAwayPitcher = DEFAULT_AWAY_PITCHER;

  private handleLineupChange = (event: Event) => {
    const detail = ((event as CustomEvent).detail ?? {}) as LineupDraftDetail;
    this.pendingHomeLineup = fromEditorPlayers(detail.homeLineup, this.pendingHomeLineup);
    this.pendingAwayLineup = fromEditorPlayers(detail.awayLineup, this.pendingAwayLineup);
    if (typeof detail.homePitcherName === 'string' && detail.homePitcherName.trim()) {
      this.pendingHomePitcher = detail.homePitcherName.trim();
    }
    if (typeof detail.awayPitcherName === 'string' && detail.awayPitcherName.trim()) {
      this.pendingAwayPitcher = detail.awayPitcherName.trim();
    }
  };

  private handleSubmit = (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    const home = String(formData.get('home-team') ?? '');
    const away = String(formData.get('away-team') ?? '');
    const innings = Number(formData.get('innings') ?? DEFAULT_GAME_SETUP.innings);
    const setup: LocalGameSetup = {
      homeTeamName: home.trim() || DEFAULT_GAME_SETUP.homeTeamName,
      awayTeamName: away.trim() || DEFAULT_GAME_SETUP.awayTeamName,
      innings: Math.min(9, Math.max(1, innings || DEFAULT_GAME_SETUP.innings)),
      homeLineup: this.pendingHomeLineup,
      awayLineup: this.pendingAwayLineup,
      homePitcherName: this.pendingHomePitcher,
      awayPitcherName: this.pendingAwayPitcher,
    };
    this.dispatchEvent(
      new CustomEvent<LocalGameSetup>('start-game', { detail: setup, bubbles: true, composed: true })
    );
  };

  render() {
    return html`
      <main class="local-setup">
        <div class="card">
          <h1>⚾ Grand Slam Baseball — Local Game Setup</h1>
          <p class="text-muted">
            Everything runs entirely in your browser. Set the batting orders before first pitch — names, numbers, and
            positions actually stick.
          </p>
          ${this.renderForm()}
        </div>
      </main>
    `;
  }

  private renderForm() {
    return html`
      <form class="local-setup-form" @submit=${this.handleSubmit}>
        ${this.renderTeamInputs()} ${this.renderLineupEditor()}
        <button type="submit" class="btn btn-primary" data-testid="start-game-button">Start Local Game</button>
      </form>
    `;
  }

  private renderTeamInputs() {
    return html`
      <label for="home-team-input">Home Team</label>
      <input id="home-team-input" data-testid="home-team-input" name="home-team" value="${DEFAULT_GAME_SETUP.homeTeamName}" />
      <label for="away-team-input">Away Team</label>
      <input id="away-team-input" data-testid="away-team-input" name="away-team" value="${DEFAULT_GAME_SETUP.awayTeamName}" />
      <label for="innings-input">Innings</label>
      <input id="innings-input" data-testid="innings-input" name="innings" type="number" min="1" max="9" value="${DEFAULT_GAME_SETUP.innings}" />
    `;
  }

  private renderLineupEditor() {
    return html`
      <baseball-lineup-setup
        variant="embedded"
        home-team-name=${DEFAULT_GAME_SETUP.homeTeamName}
        away-team-name=${DEFAULT_GAME_SETUP.awayTeamName}
        home-pitcher-name=${DEFAULT_HOME_PITCHER}
        away-pitcher-name=${DEFAULT_AWAY_PITCHER}
        home-lineup-json=${toEditorJson(toLineupPlayers(DEFAULT_HOME_LINEUP))}
        away-lineup-json=${toEditorJson(toLineupPlayers(DEFAULT_AWAY_LINEUP))}
        @lineup-change=${this.handleLineupChange}
      ></baseball-lineup-setup>
    `;
  }
}

customElements.define('baseball-setup-screen', BaseballSetupScreen);
