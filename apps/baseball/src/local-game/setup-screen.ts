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
import { generateMatchup, lineupFromRoster, rosterFromLineup } from '../sim/generate-roster';
import { mulberry32 } from '../sim/rng';
import type { SimRoster } from '../sim/types';

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

function nextSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

export class BaseballSetupScreen extends LitElement {
  createRenderRoot() {
    return this;
  }

  private homeTeam = DEFAULT_GAME_SETUP.homeTeamName;
  private awayTeam = DEFAULT_GAME_SETUP.awayTeamName;
  private innings = DEFAULT_GAME_SETUP.innings;
  private pendingHomeLineup = toLineupPlayers(DEFAULT_HOME_LINEUP);
  private pendingAwayLineup = toLineupPlayers(DEFAULT_AWAY_LINEUP);
  private pendingHomePitcher = DEFAULT_HOME_PITCHER;
  private pendingAwayPitcher = DEFAULT_AWAY_PITCHER;
  private homeRoster: SimRoster | undefined;
  private awayRoster: SimRoster | undefined;
  private simSeed = nextSeed();
  private lineupSyncToken = 0;

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

  private handleGenerate = () => {
    this.simSeed = nextSeed();
    const matchup = generateMatchup(mulberry32(this.simSeed));
    this.awayTeam = matchup.away.teamName;
    this.homeTeam = matchup.home.teamName;
    this.awayRoster = matchup.away;
    this.homeRoster = matchup.home;
    this.pendingAwayLineup = lineupFromRoster(matchup.away);
    this.pendingHomeLineup = lineupFromRoster(matchup.home);
    this.pendingAwayPitcher = matchup.away.pitcher.name;
    this.pendingHomePitcher = matchup.home.pitcher.name;
    this.lineupSyncToken += 1;
    this.requestUpdate();
  };

  private handleSubmit = (event: Event) => {
    event.preventDefault();
    this.emitStart('score');
  };

  private handleWatch = () => {
    this.emitStart('watch');
  };

  private emitStart(mode: LocalGameSetup['mode']) {
    const setup = this.buildSetup(mode);
    this.dispatchEvent(new CustomEvent<LocalGameSetup>('start-game', { detail: setup, bubbles: true, composed: true }));
  }

  private buildSetup(mode: LocalGameSetup['mode']): LocalGameSetup {
    const setup: LocalGameSetup = {
      homeTeamName: this.homeTeam.trim() || DEFAULT_GAME_SETUP.homeTeamName,
      awayTeamName: this.awayTeam.trim() || DEFAULT_GAME_SETUP.awayTeamName,
      innings: Math.min(9, Math.max(1, this.innings || DEFAULT_GAME_SETUP.innings)),
      homeLineup: this.pendingHomeLineup,
      awayLineup: this.pendingAwayLineup,
      homePitcherName: this.pendingHomePitcher,
      awayPitcherName: this.pendingAwayPitcher,
      mode,
    };
    if (mode === 'watch') this.attachWatchRosters(setup);
    return setup;
  }

  private attachWatchRosters(setup: LocalGameSetup) {
    const rosters = this.rostersForStart();
    setup.simSeed = this.simSeed;
    setup.homeRoster = rosters.home;
    setup.awayRoster = rosters.away;
  }

  private rostersForStart(): { home: SimRoster; away: SimRoster } {
    if (this.homeRoster && this.awayRoster) {
      return { home: this.homeRoster, away: this.awayRoster };
    }
    const random = mulberry32(this.simSeed);
    return {
      away: rosterFromLineup(random, this.awayTeam, this.pendingAwayLineup, this.pendingAwayPitcher),
      home: rosterFromLineup(random, this.homeTeam, this.pendingHomeLineup, this.pendingHomePitcher),
    };
  }

  render() {
    return html`
      <main class="local-setup">
        <div class="card">
          <h1>⚾ Grand Slam Baseball — Local Game Setup</h1>
          <p class="text-muted">
            Score a game yourself, or generate teams and watch a simulated match. Everything runs in your browser.
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
        <div class="setup-actions">
          <button type="button" class="btn btn-secondary" data-testid="generate-teams-button" @click=${this.handleGenerate}>
            Generate Teams
          </button>
          <button type="submit" class="btn btn-primary" data-testid="start-game-button">Start Local Game</button>
          <button type="button" class="btn btn-primary" data-testid="watch-game-button" @click=${this.handleWatch}>
            Watch Simulated Game
          </button>
        </div>
      </form>
    `;
  }

  private renderTeamInputs() {
    return html`
      ${this.renderTextField('home-team', 'Home Team', this.homeTeam, (value) => {
        this.homeTeam = value;
      })}
      ${this.renderTextField('away-team', 'Away Team', this.awayTeam, (value) => {
        this.awayTeam = value;
      })}
      ${this.renderInningsField()}
    `;
  }

  private renderTextField(name: string, label: string, value: string, onChange: (value: string) => void) {
    return html`
      <label for="${name}-input">${label}</label>
      <input
        id="${name}-input"
        data-testid="${name}-input"
        name=${name}
        .value=${value}
        @input=${(event: Event) => onChange((event.target as HTMLInputElement).value)}
      />
    `;
  }

  private renderInningsField() {
    return html`
      <label for="innings-input">Innings</label>
      <input
        id="innings-input"
        data-testid="innings-input"
        name="innings"
        type="number"
        min="1"
        max="9"
        .value=${String(this.innings)}
        @input=${(event: Event) => {
          this.innings = Number((event.target as HTMLInputElement).value);
        }}
      />
    `;
  }

  private renderLineupEditor() {
    return html`
      <baseball-lineup-setup
        variant="embedded"
        sync-token=${String(this.lineupSyncToken)}
        home-team-name=${this.homeTeam}
        away-team-name=${this.awayTeam}
        home-pitcher-name=${this.pendingHomePitcher}
        away-pitcher-name=${this.pendingAwayPitcher}
        home-lineup-json=${toEditorJson(this.pendingHomeLineup)}
        away-lineup-json=${toEditorJson(this.pendingAwayLineup)}
        @lineup-change=${this.handleLineupChange}
      ></baseball-lineup-setup>
    `;
  }
}

customElements.define('baseball-setup-screen', BaseballSetupScreen);
