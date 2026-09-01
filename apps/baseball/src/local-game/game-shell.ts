import { LitElement, html, nothing } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { TemplateResult } from 'lit';
import { Virtualizer, observeElementOffset, observeElementRect } from '@tanstack/virtual-core';
import type { VirtualItem, VirtualizerOptions } from '@tanstack/virtual-core';
import type { LiveLocalGameState } from './game-state';
import type { GameStore } from './game-store';
import type { LocalGameEventRecord } from './game-types';
import { buildBoxScore } from './box-score';
import { boxScoreOverlay } from './box-score-view';
import {
  battingBatterName,
  editorPlayersToLineup,
  engineBadge,
  lastPlayLabel,
  pitchingPitcherName,
  rowsToEditorPlayers,
  runnerOnBaseName,
  scorebookSlots,
} from './game-shell-helpers';

const HIT_EVENT_TYPES = new Set(['SINGLE', 'DOUBLE', 'TRIPLE', 'HOME_RUN']);
const DOUBLE_PLAY_EVENT_TYPES = new Set(['GROUNDOUT', 'LINE_OUT']);

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
    if (root) this.removeAllListeners(root);
    this.virtualizerCleanup?.();
    this.virtualizerCleanup = null;
    this.virtualizer = null;
    this.scrollEl = null;
    super.disconnectedCallback();
  }

  private removeAllListeners(root: HTMLElement) {
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
      onChange: () => this.handleVirtualChange(),
    };
  }

  private handleVirtualChange() {
    const items = this.virtualizer?.getVirtualItems() ?? [];
    const key = items.map((item) => `${item.index}:${item.start}:${item.size}`).join('|');
    if (key !== this.virtualItemsKey) {
      this.virtualItemsKey = key;
      this.requestUpdate();
    }
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
    return html` <main class="local-shell">${this.renderContainer(game)} ${this.renderEventLog(game)}</main> `;
  }

  private renderContainer(game: LiveLocalGameState) {
    const { setup, engine } = game;
    const currentBatter = battingBatterName(engine);
    const currentPitcher = pitchingPitcherName(engine);
    return html`
      <div ${ref(this.containerRef)}>
        <baseball-scorer-tab away-name=${setup.awayTeamName} home-name=${setup.homeTeamName}>
          <div slot="scoreboard">${this.renderScoreboardSlot(game, currentBatter, currentPitcher)}</div>
          <div slot="controls">${this.renderControlsSlot(engine, currentBatter, currentPitcher)}</div>
          <div slot="scorebook">${this.renderScorebookSlot(engine, setup)}</div>
        </baseball-scorer-tab>
        ${this.renderLineupSetup(engine, setup)}
      </div>
    `;
  }

  private renderScoreboardSlot(game: LiveLocalGameState, currentBatter: string, currentPitcher: string) {
    const gameJson = this.buildGameJson(game, currentBatter, currentPitcher);
    const boxScoreJson = this.buildBoxScoreJson(game);
    return html`<baseball-scoreboard game-json=${JSON.stringify(gameJson)} box-score-json=${JSON.stringify(boxScoreJson)} />`;
  }

  private buildGameJson(game: LiveLocalGameState, currentBatter: string, currentPitcher: string) {
    const { setup, engine } = game;
    const events = this.visibleEvents();
    return {
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
  }

  private buildBoxScoreJson(game: LiveLocalGameState) {
    const boxScore = buildBoxScore(game.engine);
    return {
      lineScore: {
        awayHits: boxScore.away.hits,
        homeHits: boxScore.home.hits,
        awayErrors: boxScore.away.errors,
        homeErrors: boxScore.home.errors,
      },
    };
  }

  private renderControlsSlot(engine: LiveLocalGameState['engine'], currentBatter: string, currentPitcher: string) {
    const { setup } = this.game as LiveLocalGameState;
    return html`
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
    `;
  }

  private renderScorebookSlot(engine: LiveLocalGameState['engine'], setup: LiveLocalGameState['setup']) {
    return html`
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
    `;
  }

  private renderLineupSetup(engine: LiveLocalGameState['engine'], setup: LiveLocalGameState['setup']) {
    return html`
      <baseball-lineup-setup
        ?is-open=${this.lineupOpen}
        home-team-name=${setup.homeTeamName}
        away-team-name=${setup.awayTeamName}
        home-pitcher-name=${engine.homeLineup.pitcherName ?? ''}
        away-pitcher-name=${engine.awayLineup.pitcherName ?? ''}
        home-lineup-json=${JSON.stringify(rowsToEditorPlayers(engine.homeLineup.rows))}
        away-lineup-json=${JSON.stringify(rowsToEditorPlayers(engine.awayLineup.rows))}
      ></baseball-lineup-setup>
    `;
  }

  private renderEventLog(game: LiveLocalGameState) {
    const { engine } = game;
    const events = this.visibleEvents();
    const boxScore = buildBoxScore(engine);
    return html`
      <section class="event-log card" data-testid="local-game-state">
        ${this.renderEventLogHeader(game)} ${this.renderEventLogBody(events)} ${this.renderBoxScoreSection(boxScore)}
      </section>
    `;
  }

  private renderEventLogHeader(game: LiveLocalGameState) {
    const canUndo = game.historyIndex > 0;
    const canRedo = game.historyIndex < game.events.length;
    const { engine } = game;
    return html`
      <div class="event-log-header">
        <h2>Play-by-Play <span class="engine-badge" data-testid="engine-state-badge">${engineBadge(engine)}</span></h2>
        <button class="btn btn-secondary" ?disabled=${!canUndo} @click=${this.onUndo} data-testid="undo-button">Undo</button>
        <button class="btn btn-secondary" ?disabled=${!canRedo} @click=${this.onRedo} data-testid="redo-button">Redo</button>
        <button class="btn btn-secondary" @click=${this.onExportScorebook} data-testid="export-scorebook-button">Export Scorebook (PDF)</button>
        <button class="btn btn-secondary" @click=${this.onBoxScore} data-testid="box-score-button">Box Score</button>
        <button class="btn btn-secondary" @click=${this.onNewGame} data-testid="new-game-button">New Game</button>
      </div>
      <p class="text-muted">Scoring events advance the count, outs, inning, and score. Use Undo/Redo to correct mistakes.</p>
    `;
  }

  private renderEventLogBody(events: LocalGameEventRecord[]) {
    if (events.length === 0) return this.renderEmptyLog();
    return html`
      <div class="event-log-scroll" ${ref(this.scrollRef)}>
        <ul
          class="event-log-list"
          data-testid="event-log-list"
          style="position: relative; height: ${this.virtualizer?.getTotalSize() ?? events.length * 28}px;"
        >
          ${this.renderLogItems(events)}
        </ul>
      </div>
    `;
  }

  private renderEmptyLog() {
    return html`
      <p class="text-muted" data-testid="no-events-message">No plays recorded yet. Score the first at-bat with the controls above.</p>
    `;
  }

  private renderBoxScoreSection(boxScore: ReturnType<typeof buildBoxScore>) {
    if (!this.boxScoreOpen) return nothing;
    return boxScoreOverlay(boxScore, boxScore.innings, this.closeBoxScore);
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
}

customElements.define('baseball-game-shell', BaseballGameShell);
