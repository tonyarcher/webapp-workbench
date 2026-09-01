import { LitElement, html, nothing } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { TemplateResult } from 'lit';
import { Virtualizer, observeElementOffset, observeElementRect } from '@tanstack/virtual-core';
import type { VirtualItem, VirtualizerOptions } from '@tanstack/virtual-core';
import type { LiveLocalGameState } from './game-state';
import type { GameStore } from './game-store';
import type { LocalGameEventRecord } from './game-types';
import type { EngineGameState, EngineScorebookRow } from './rule-engine';
import type { LineupPlayer } from './game-types';
import { buildBoxScore } from './box-score';
import type { BoxScoreTeam } from './box-score';

const HIT_EVENT_TYPES = new Set(['SINGLE', 'DOUBLE', 'TRIPLE', 'HOME_RUN']);
const DOUBLE_PLAY_EVENT_TYPES = new Set(['GROUNDOUT', 'LINE_OUT']);
const SCORING_EVENT_TYPES = new Set([
  'BALL',
  'STRIKE',
  'FOUL',
  'STRIKEOUT',
  'WALK',
  'HIT_BY_PITCH',
  'SINGLE',
  'DOUBLE',
  'TRIPLE',
  'HOME_RUN',
  'GROUNDOUT',
  'FLYOUT',
  'LINE_OUT',
  'POP_OUT',
  'SACRIFICE_FLY',
  'SACRIFICE_BUNT',
  'ERROR',
  'FIELDER_CHOICE',
  'STOLEN_BASE',
  'CAUGHT_STEALING',
  'WILD_PITCH',
  'PASSED_BALL',
  'BALK',
  'SET_LINEUP',
]);

let eventSequence = 0;

function nextEventId(): number {
  eventSequence += 1;
  return eventSequence;
}

export class BaseballGameShell extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    game: { attribute: false },
    store: { attribute: false },
  };

  declare game: LiveLocalGameState | null;
  declare store: GameStore | null;

  constructor() {
    super();
    this.game = null;
    this.store = null;
  }

  private panelMode: 'action-grid' | 'step2' = 'action-grid';
  private step2Label = '';
  private step2IsHit = false;
  private step2DoublePlayAvailable = false;
  private lineupOpen = false;
  private boxScoreOpen = false;
  private pendingEventType = '';
  private pendingBaseLabel = '';
  private lastEventKey = '';
  private currentPitchType = '';

  private containerRef = createRef<HTMLDivElement>();
  private scrollRef = createRef<HTMLDivElement>();
  private scrollEl: HTMLDivElement | null = null;
  private virtualizer: Virtualizer<HTMLDivElement, HTMLElement> | null = null;
  private virtualizerCleanup: (() => void) | null = null;
  private virtualItemsKey = '';

  firstUpdated() {
    const root = this.containerRef.value;
    if (root) {
      root.addEventListener('trigger-scoring-event', this.handleTriggerScoringEvent);
      root.addEventListener('render-step2', this.handleRenderStep2);
      root.addEventListener('location-selected', this.handleLocationSelected);
      root.addEventListener('cancel-step2', this.handleCancelStep2);
      root.addEventListener('open-lineup-setup-click', this.handleOpenLineupSetup);
      root.addEventListener('close-lineup-setup', this.handleCloseLineupSetup);
      root.addEventListener('save-lineup-setup', this.handleSaveLineupSetup);
      root.addEventListener('view-boxscore', this.handleViewBoxScore);
      root.addEventListener('pitch-type-selected', this.handlePitchTypeSelected);
    }
    this.ensureVirtualizer();
  }

  disconnectedCallback() {
    const root = this.containerRef.value;
    if (root) {
      root.removeEventListener('trigger-scoring-event', this.handleTriggerScoringEvent);
      root.removeEventListener('render-step2', this.handleRenderStep2);
      root.removeEventListener('location-selected', this.handleLocationSelected);
      root.removeEventListener('cancel-step2', this.handleCancelStep2);
      root.removeEventListener('open-lineup-setup-click', this.handleOpenLineupSetup);
      root.removeEventListener('close-lineup-setup', this.handleCloseLineupSetup);
      root.removeEventListener('save-lineup-setup', this.handleSaveLineupSetup);
      root.removeEventListener('view-boxscore', this.handleViewBoxScore);
      root.removeEventListener('pitch-type-selected', this.handlePitchTypeSelected);
    }
    this.virtualizerCleanup?.();
    this.virtualizerCleanup = null;
    this.virtualizer = null;
    this.scrollEl = null;
    super.disconnectedCallback();
  }

  updated() {
    this.ensureVirtualizer();
    this.virtualizer?._willUpdate();
    const count = this.visibleEvents().length;
    if (this.virtualizer && this.virtualizer.options.count !== count) {
      this.virtualizer.setOptions(this.buildVirtualizerOptions(count));
    }
    this.virtualizer?.measure();
  }

  private visibleEvents(): LocalGameEventRecord[] {
    return this.game ? this.game.events.slice(0, this.game.historyIndex) : [];
  }

  private buildVirtualizerOptions(count: number): VirtualizerOptions<HTMLDivElement, HTMLElement> {
    return {
      count,
      getScrollElement: () => this.scrollEl,
      estimateSize: () => 28,
      overscan: 8,
      getItemKey: (index) => this.visibleEvents()[index]?.id ?? index,
      observeElementRect,
      observeElementOffset,
      scrollToFn: (offset, options, instance) => {
        instance.scrollElement?.scrollTo({ top: offset, behavior: options.behavior });
      },
      onChange: () => {
        const items = this.virtualizer?.getVirtualItems() ?? [];
        const key = items.map((item) => `${item.index}:${item.start}:${item.size}`).join('|');
        if (key !== this.virtualItemsKey) {
          this.virtualItemsKey = key;
          this.requestUpdate();
        }
      },
    };
  }

  private ensureVirtualizer() {
    if (this.virtualizer || !this.scrollRef.value) return;
    this.scrollEl = this.scrollRef.value;
    this.virtualizer = new Virtualizer<HTMLDivElement, HTMLElement>(
      this.buildVirtualizerOptions(this.visibleEvents().length)
    );
    this.virtualizerCleanup = this.virtualizer._didMount();
  }

  private handleTriggerScoringEvent = (event: Event) => {
    const detail = ((event as CustomEvent).detail ?? {}) as Record<string, unknown>;
    this.recordOnce(event, String(detail.eventType ?? 'trigger-scoring-event'), detail);
  };

  private handleRenderStep2 = (event: Event) => {
    const detail = ((event as CustomEvent).detail ?? {}) as Record<string, unknown>;
    const eventType = String(detail.eventType ?? '');
    this.pendingEventType = eventType;
    this.pendingBaseLabel = String(detail.baseLabel ?? '');
    this.step2Label = String(detail.baseLabel ?? '');
    this.step2IsHit = HIT_EVENT_TYPES.has(eventType);
    this.step2DoublePlayAvailable = DOUBLE_PLAY_EVENT_TYPES.has(eventType);
    this.panelMode = 'step2';
    this.requestUpdate();
  };

  private handleLocationSelected = (event: Event) => {
    const detail = ((event as CustomEvent).detail ?? {}) as Record<string, unknown>;
    const eventType = this.pendingEventType;
    const baseLabel = this.pendingBaseLabel;
    this.pendingEventType = '';
    this.pendingBaseLabel = '';
    this.panelMode = 'action-grid';
    this.recordOnce(event, eventType, { ...detail, baseLabel });
    this.requestUpdate();
  };

  private handleCancelStep2 = () => {
    this.pendingEventType = '';
    this.pendingBaseLabel = '';
    this.panelMode = 'action-grid';
    this.requestUpdate();
  };

  private handleOpenLineupSetup = () => {
    this.lineupOpen = true;
    this.requestUpdate();
  };

  private handleCloseLineupSetup = () => {
    this.lineupOpen = false;
    this.requestUpdate();
  };

  private handleSaveLineupSetup = (event: Event) => {
    const detail = ((event as CustomEvent).detail ?? {}) as Record<string, unknown>;
    this.lineupOpen = false;
    this.record('SET_LINEUP', {
      homeLineup: editorPlayersToLineup(detail.homeLineup),
      awayLineup: editorPlayersToLineup(detail.awayLineup),
      homePitcherName: String(detail.homePitcherName ?? ''),
      awayPitcherName: String(detail.awayPitcherName ?? ''),
    });
    this.requestUpdate();
  };

  private handlePitchTypeSelected = (event: Event) => {
    const detail = ((event as CustomEvent).detail ?? {}) as Record<string, unknown>;
    this.currentPitchType = String(detail.pitchType ?? '');
    this.requestUpdate();
  };

  private handleViewBoxScore = () => {
    this.boxScoreOpen = true;
    this.requestUpdate();
  };

  private onBoxScore = () => {
    this.boxScoreOpen = !this.boxScoreOpen;
    this.requestUpdate();
  };

  private closeBoxScore = () => {
    this.boxScoreOpen = false;
    this.requestUpdate();
  };

  private recordOnce(event: Event, eventType: string, detail: Record<string, unknown>) {
    const eventKey = `${eventType}:${Math.round(event.timeStamp)}`;
    if (eventKey === this.lastEventKey) return;
    this.lastEventKey = eventKey;
    this.record(eventType, detail);
  }

  private record(eventType: string, detail: Record<string, unknown>) {
    const withPitch = this.currentPitchType ? { ...detail, pitchType: this.currentPitchType } : detail;
    this.currentPitchType = '';
    this.store?.recordEvent({
      id: nextEventId(),
      eventType,
      occurredAt: new Date().toISOString(),
      detail: withPitch,
    });
  }

  private onExportScorebook = () => {
    window.print();
  };

  private onUndo = () => {
    this.store?.undo();
  };

  private onRedo = () => {
    this.store?.redo();
  };

  private onNewGame = () => {
    this.store?.newGame();
  };

  render() {
    const game = this.game;
    if (!game) return nothing;
    const { setup, engine } = game;
    const events = this.visibleEvents();
    const canUndo = game.historyIndex > 0;
    const canRedo = game.historyIndex < game.events.length;
    const currentBatter = battingBatterName(engine);
    const currentPitcher = pitchingPitcherName(engine);

    const gameJson = {
      id: 1,
      awayTeam: { id: 2, name: setup.awayTeamName },
      homeTeam: { id: 1, name: setup.homeTeamName },
      awayScore: engine.awayScore,
      homeScore: engine.homeScore,
      status: engine.over ? 'FINAL' : 'IN_PROGRESS',
      gameState: {
        inning: engine.inning,
        half: engine.half,
        balls: engine.balls,
        strikes: engine.strikes,
        outs: engine.outs,
        runnerFirstId: engine.runners[0] ? 1 : 0,
        runnerSecondId: engine.runners[1] ? 1 : 0,
        runnerThirdId: engine.runners[2] ? 1 : 0,
        runnerFirstName: runnerOnBaseName(engine, 0),
        runnerSecondName: runnerOnBaseName(engine, 1),
        runnerThirdName: runnerOnBaseName(engine, 2),
        currentBatterName: currentBatter,
        currentPitcherName: currentPitcher,
        lastPlay: lastPlayLabel(events),
      },
    };

    const boxScore = buildBoxScore(engine);
    const boxScoreJson = {
      lineScore: {
        awayHits: boxScore.away.hits,
        homeHits: boxScore.home.hits,
        awayErrors: boxScore.away.errors,
        homeErrors: boxScore.home.errors,
      },
    };

    return html`
      <main class="local-shell">
        <div ${ref(this.containerRef)}>
          <baseball-scorer-tab away-name=${setup.awayTeamName} home-name=${setup.homeTeamName}>
            <div slot="scoreboard">
              <baseball-scoreboard game-json=${JSON.stringify(gameJson)} box-score-json=${JSON.stringify(boxScoreJson)} />
            </div>
            <div slot="controls">
              <baseball-scoring-controls
                game-status=${engine.over ? 'completed' : 'active'}
                away-name=${setup.awayTeamName}
                home-name=${setup.homeTeamName}
                away-score=${String(engine.awayScore)}
                home-score=${String(engine.homeScore)}
                balls=${engine.balls}
                strikes=${engine.strikes}
                outs=${engine.outs}
                live-inning-text=${engineBadge(engine)}
                batter-name=${currentBatter}
                pitcher-name=${currentPitcher}
                panel-mode=${this.panelMode}
                current-pitch-type=${this.currentPitchType}
                step2-label=${this.step2Label}
                ?step2-is-hit=${this.step2IsHit}
                ?step2-double-play-available=${this.step2DoublePlayAvailable}
              ></baseball-scoring-controls>
            </div>
            <div slot="scorebook">
              <baseball-scorebook-grid
                team-name=${setup.awayTeamName}
                max-inning=${String(setup.innings)}
                slots-json=${JSON.stringify(scorebookSlots(engine.awayLineup.rows))}
              ></baseball-scorebook-grid>
              <baseball-scorebook-grid
                team-name=${setup.homeTeamName}
                max-inning=${String(setup.innings)}
                slots-json=${JSON.stringify(scorebookSlots(engine.homeLineup.rows))}
              ></baseball-scorebook-grid>
            </div>
          </baseball-scorer-tab>

          <baseball-lineup-setup
            ?is-open=${this.lineupOpen}
            home-team-name=${setup.homeTeamName}
            away-team-name=${setup.awayTeamName}
            home-pitcher-name=${engine.homeLineup.pitcherName ?? ''}
            away-pitcher-name=${engine.awayLineup.pitcherName ?? ''}
            home-lineup-json=${JSON.stringify(rowsToEditorPlayers(engine.homeLineup.rows))}
            away-lineup-json=${JSON.stringify(rowsToEditorPlayers(engine.awayLineup.rows))}
          ></baseball-lineup-setup>
        </div>

        <section class="event-log card" data-testid="local-game-state">
          <div class="event-log-header">
            <h2>
              Play-by-Play
              <span class="engine-badge" data-testid="engine-state-badge">${engineBadge(engine)}</span>
            </h2>
            <button class="btn btn-secondary" ?disabled=${!canUndo} @click=${this.onUndo} data-testid="undo-button">
              Undo
            </button>
            <button class="btn btn-secondary" ?disabled=${!canRedo} @click=${this.onRedo} data-testid="redo-button">
              Redo
            </button>
            <button class="btn btn-secondary" @click=${this.onExportScorebook} data-testid="export-scorebook-button">
              Export Scorebook (PDF)
            </button>
            <button class="btn btn-secondary" @click=${this.onBoxScore} data-testid="box-score-button">
              Box Score
            </button>
            <button class="btn btn-secondary" @click=${this.onNewGame} data-testid="new-game-button">
              New Game
            </button>
          </div>
          <p class="text-muted">
            Scoring events advance the count, outs, inning, and score. Use Undo/Redo to correct mistakes.
          </p>
          ${events.length === 0
        ? html`
                <p class="text-muted" data-testid="no-events-message">
                  No plays recorded yet. Score the first at-bat with the controls above.
                </p>
              `
        : html`
                <div class="event-log-scroll" ${ref(this.scrollRef)}>
                  <ul
                    class="event-log-list"
                    data-testid="event-log-list"
                    style="position: relative; height: ${this.virtualizer?.getTotalSize() ?? events.length * 28}px;"
                  >
                    ${this.renderLogItems(events)}
                  </ul>
                </div>
              `}
          ${this.boxScoreOpen ? this.renderBoxScore(boxScore, boxScore.innings) : nothing}
        </section>
      </main>
    `;
  }

  private renderLogItems(events: LocalGameEventRecord[]): TemplateResult[] {
    const virtualizer = this.virtualizer;
    if (virtualizer) {
      return virtualizer.getVirtualItems().flatMap((item) => {
        const event = events[item.index];
        return event ? [this.renderEventItem(event, item)] : [];
      });
    }
    return events.map((event) => this.renderEventItem(event, null));
  }

  private renderEventItem(event: LocalGameEventRecord, item: VirtualItem | null): TemplateResult {
    const itemStyle = item
      ? `position:absolute;top:0;left:0;width:100%;height:${item.size}px;transform:translateY(${item.start}px);`
      : '';
    return html`
      <li class="event-log-item" data-testid="event-${event.id}" style=${itemStyle}>
        <span class="event-id">#${event.id}</span>
        <span class="event-type">${event.eventType}</span>
        <span class="event-detail">${JSON.stringify(event.detail)}</span>
      </li>
    `;
  }

  private renderBoxScore(boxScore: ReturnType<typeof buildBoxScore>, innings: number): TemplateResult {
    return html`
      <div class="box-score-overlay" data-testid="box-score-modal" @click=${this.closeBoxScore}>
        <div class="box-score-modal" @click=${(event: Event) => event.stopPropagation()}>
          <div class="box-score-header">
            <h3>Box Score</h3>
            <button class="btn btn-secondary" @click=${this.closeBoxScore} data-testid="close-box-score-button">
              Close
            </button>
          </div>
          <table class="line-score-table">
            <thead>
              <tr>
                <th>Team</th>
                ${inningColumns(innings).map((n) => html`<th key=${n}>${n}</th>`)}
                <th>R</th>
                <th>H</th>
                <th>E</th>
              </tr>
            </thead>
            <tbody>
              ${lineScoreRow(boxScore.away, innings)}
              ${lineScoreRow(boxScore.home, innings)}
            </tbody>
          </table>
          <div class="batting-tables">
            ${battingTable(boxScore.away)}
            ${battingTable(boxScore.home)}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('baseball-game-shell', BaseballGameShell);

function inningColumns(total: number): number[] {
  return Array.from({ length: total }, (_, index) => index + 1);
}

function lineScoreRow(team: BoxScoreTeam, innings: number): TemplateResult {
  return html`
    <tr data-testid="line-score-row-${team.name}">
      <td>${team.name}</td>
      ${inningColumns(innings).map((n) => html`<td data-testid="inning-${team.name}-${n}">${team.runsByInning[n - 1] ?? 0}</td>`)}
      <td class="box-score-total" data-testid="runs-${team.name}">${team.runs}</td>
      <td data-testid="hits-${team.name}">${team.hits}</td>
      <td data-testid="errors-${team.name}">${team.errors}</td>
    </tr>
  `;
}

function battingTable(team: BoxScoreTeam): TemplateResult {
  return html`
    <table class="batting-table" data-testid="batting-table-${team.name}">
      <caption>${team.name} Batting</caption>
      <thead>
        <tr>
          <th>Player</th>
          <th>AB</th>
          <th>R</th>
          <th>H</th>
          <th>RBI</th>
          <th>BB</th>
        </tr>
      </thead>
      <tbody>
        ${team.batting.map(
    (line) => html`
            <tr>
              <td>${line.player}</td>
              <td>${line.ab}</td>
              <td>${line.runs}</td>
              <td>${line.hits}</td>
              <td>${line.rbi}</td>
              <td>${line.walks}</td>
            </tr>
          `
  )}
      </tbody>
    </table>
  `;
}

function battingBatterName(engine: EngineGameState): string {
  const lineup = engine.half === 'TOP' ? engine.awayLineup : engine.homeLineup;
  const index = engine.half === 'TOP' ? engine.awayBatterIdx : engine.homeBatterIdx;
  return lineup.rows[index % lineup.rows.length]?.batterName ?? 'Current Batter';
}

function runnerOnBaseName(engine: EngineGameState, baseIndex: number): string {
  const slot = (engine.runnerSlots ?? [null, null, null])[baseIndex];
  if (slot === null || slot === undefined) return '';
  const lineup = engine.half === 'TOP' ? engine.awayLineup : engine.homeLineup;
  return lineup.rows.find((row) => row.slotIdx === slot)?.batterName ?? '';
}

function lastPlayLabel(events: LocalGameEventRecord[]): string {
  const last = [...events].reverse().find((event) => SCORING_EVENT_TYPES.has(event.eventType));
  if (!last) return 'Awaiting first play';
  const detail = last.detail ?? {};
  const parts = [last.eventType];
  if (detail.doublePlay === true) parts.push('DOUBLE PLAY');
  if (detail.location) parts.push(String(detail.location));
  if (detail.fieldPos) parts.push(`F${detail.fieldPos}`);
  return parts.join(' · ');
}

function pitchingPitcherName(engine: EngineGameState): string {
  const lineup = engine.half === 'TOP' ? engine.homeLineup : engine.awayLineup;
  if (lineup.pitcherName) return lineup.pitcherName;
  return lineup.rows.find((row) => row.position === 'P')?.batterName ?? `${lineup.name} pitcher`;
}

function rowsToEditorPlayers(rows: EngineScorebookRow[]): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    id: row.slotIdx,
    name: row.batterName,
    jerseyNumber: row.jerseyNumber ?? 0,
    position: row.position,
  }));
}

function editorPlayersToLineup(value: unknown): LineupPlayer[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const record = entry as Record<string, unknown>;
    return {
      batterName: String(record.batterName ?? record.name ?? '').trim(),
      position: String(record.position ?? 'DH').trim() || 'DH',
      jerseyNumber: Number(record.jerseyNumber ?? 0),
    };
  });
}

function scorebookSlots(rows: EngineScorebookRow[]): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    slotIdx: row.slotIdx,
    batterName: row.batterName,
    position: row.position,
    jerseyNumber: row.jerseyNumber,
    atBats: row.atBats,
    runs: row.runs,
    hits: row.hits,
    rbi: row.rbi,
    innings: row.innings,
  }));
}

function engineBadge(engine: EngineGameState): string {
  if (engine.over) {
    return `${engine.inning} inn · FINAL · Away ${engine.awayScore} · Home ${engine.homeScore}`;
  }
  const halfLabel = engine.half === 'TOP' ? 'Top' : 'Bottom';
  return `${halfLabel} ${engine.inning} · ${engine.balls} balls · ${engine.strikes} strikes · ${engine.outs} outs`;
}
