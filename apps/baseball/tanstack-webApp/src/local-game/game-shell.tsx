import { useEffect, useRef, useState } from 'react';
import type { LocalGameEventRecord, LocalGameSetup } from './game-types';
import { DEFAULT_AWAY_LINEUP, DEFAULT_HOME_LINEUP } from './default-lineups';
import { buildBoxScore } from './box-score';
import type { BoxScoreTeam } from './box-score';
import type { EngineGameState, EngineScorebookRow } from './rule-engine';
import './local-game.css';

interface LocalGameShellProps {
  setup: LocalGameSetup;
  engine: EngineGameState;
  events: LocalGameEventRecord[];
  canUndo: boolean;
  canRedo: boolean;
  onEventRecorded: (event: LocalGameEventRecord) => void;
  onUndo: () => void;
  onRedo: () => void;
  onNewGame: () => void;
}

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
  'ERROR',
  'FIELDER_CHOICE',
]);

let eventSequence = 0;

function nextEventId(): number {
  eventSequence += 1;
  return eventSequence;
}

export function LocalGameShell({
  setup,
  engine,
  events,
  canUndo,
  canRedo,
  onEventRecorded,
  onUndo,
  onRedo,
  onNewGame,
}: LocalGameShellProps) {
  const [panelMode, setPanelMode] = useState<'action-grid' | 'step2'>('action-grid');
  const [step2Label, setStep2Label] = useState('');
  const [step2IsHit, setStep2IsHit] = useState(false);
  const [step2DoublePlayAvailable, setStep2DoublePlayAvailable] = useState(false);
  const [lineupOpen, setLineupOpen] = useState(false);
  const [boxScoreOpen, setBoxScoreOpen] = useState(false);

  const onExportScorebook = () => {
    window.print();
  };

  const shellRef = useRef<HTMLDivElement>(null);
  const pendingEventTypeRef = useRef<string>('');
  const pendingBaseLabelRef = useRef<string>('');
  const lastEventKeyRef = useRef<string>('');

  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;

    const record = (eventType: string, detail: Record<string, unknown>) => {
      onEventRecorded({
        id: nextEventId(),
        eventType,
        occurredAt: new Date().toISOString(),
        detail,
      });
    };

    const recordOnce = (event: Event, eventType: string, detail: Record<string, unknown>) => {
      const eventKey = `${eventType}:${Math.round(event.timeStamp)}`;
      if (eventKey === lastEventKeyRef.current) return;
      lastEventKeyRef.current = eventKey;
      record(eventType, detail);
    };

    const handleTriggerScoringEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      recordOnce(event, String(detail.eventType ?? 'trigger-scoring-event'), detail);
    };
    const handlePitchTypeSelected = (event: Event) => {
      recordOnce(event, 'pitch-type-selected', (event as CustomEvent).detail ?? {});
    };
    const handleRenderStep2 = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      const eventType = String(detail.eventType ?? '');
      pendingEventTypeRef.current = eventType;
      pendingBaseLabelRef.current = String(detail.baseLabel ?? '');
      setStep2Label(String(detail.baseLabel ?? ''));
      setStep2IsHit(HIT_EVENT_TYPES.has(eventType));
      setStep2DoublePlayAvailable(DOUBLE_PLAY_EVENT_TYPES.has(eventType));
      setPanelMode('step2');
      recordOnce(event, 'render-step2', detail);
    };
    const handleLocationSelected = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      const eventType = pendingEventTypeRef.current;
      const baseLabel = pendingBaseLabelRef.current;
      pendingEventTypeRef.current = '';
      pendingBaseLabelRef.current = '';
      setPanelMode('action-grid');
      recordOnce(event, eventType, { ...detail, baseLabel });
    };
    const handleCancelStep2 = () => {
      pendingEventTypeRef.current = '';
      pendingBaseLabelRef.current = '';
      setPanelMode('action-grid');
      record('cancel-step2', {});
    };
    const handleOpenLineupSetup = () => {
      setLineupOpen(true);
      record('open-lineup-setup-click', {});
    };
    const handleCloseLineupSetup = () => {
      setLineupOpen(false);
      record('close-lineup-setup', {});
    };
    const handleSaveLineupSetup = () => {
      setLineupOpen(false);
      record('save-lineup-setup', {});
    };
    const handleViewBoxScore = () => {
      setBoxScoreOpen(true);
    };

    root.addEventListener('trigger-scoring-event', handleTriggerScoringEvent);
    root.addEventListener('pitch-type-selected', handlePitchTypeSelected);
    root.addEventListener('render-step2', handleRenderStep2);
    root.addEventListener('location-selected', handleLocationSelected);
    root.addEventListener('cancel-step2', handleCancelStep2);
    root.addEventListener('open-lineup-setup-click', handleOpenLineupSetup);
    root.addEventListener('close-lineup-setup', handleCloseLineupSetup);
    root.addEventListener('save-lineup-setup', handleSaveLineupSetup);
    root.addEventListener('view-boxscore', handleViewBoxScore);

    return () => {
      root.removeEventListener('trigger-scoring-event', handleTriggerScoringEvent);
      root.removeEventListener('pitch-type-selected', handlePitchTypeSelected);
      root.removeEventListener('render-step2', handleRenderStep2);
      root.removeEventListener('location-selected', handleLocationSelected);
      root.removeEventListener('cancel-step2', handleCancelStep2);
      root.removeEventListener('open-lineup-setup-click', handleOpenLineupSetup);
      root.removeEventListener('close-lineup-setup', handleCloseLineupSetup);
      root.removeEventListener('save-lineup-setup', handleSaveLineupSetup);
      root.removeEventListener('view-boxscore', handleViewBoxScore);
    };
  }, [onEventRecorded]);

  const currentBatter = battingBatterName(engine);
  const currentPitcher = pitchingTeam(engine).name;

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

  return (
    <main className="local-shell">
      <div ref={shellRef}>
        <baseball-scorer-tab away-name={setup.awayTeamName} home-name={setup.homeTeamName}>
          <div slot="scoreboard">
            <baseball-scoreboard game-json={JSON.stringify(gameJson)} box-score-json={JSON.stringify(boxScoreJson)} />
          </div>
          <div slot="controls">
            <baseball-scoring-controls
              game-status={engine.over ? 'completed' : 'active'}
              away-name={setup.awayTeamName}
              home-name={setup.homeTeamName}
              away-score={String(engine.awayScore)}
              home-score={String(engine.homeScore)}
              batter-name={currentBatter}
              pitcher-name={currentPitcher}
              panel-mode={panelMode}
              step2-label={step2Label}
              step2-is-hit={step2IsHit ? '' : undefined}
              step2-double-play-available={step2DoublePlayAvailable ? '' : undefined}
            />
          </div>
          <div slot="scorebook">
            <baseball-scorebook-grid
              team-name={setup.awayTeamName}
              max-inning={String(setup.innings)}
              slots-json={JSON.stringify(scorebookSlots(engine.awayLineup.rows))}
            />
            <baseball-scorebook-grid
              team-name={setup.homeTeamName}
              max-inning={String(setup.innings)}
              slots-json={JSON.stringify(scorebookSlots(engine.homeLineup.rows))}
            />
          </div>
        </baseball-scorer-tab>

        <baseball-lineup-setup
          is-open={lineupOpen ? '' : undefined}
          home-team-name={setup.homeTeamName}
          away-team-name={setup.awayTeamName}
          home-lineup-json={JSON.stringify(DEFAULT_HOME_LINEUP)}
          away-lineup-json={JSON.stringify(DEFAULT_AWAY_LINEUP)}
        />
      </div>

      <section className="event-log card" data-testid="local-game-state">
        <div className="event-log-header">
          <h2>
            Live Scoring{' '}
            <span className="engine-badge" data-testid="engine-state-badge">
              {engineBadge(engine)}
            </span>
          </h2>
          <button className="btn btn-secondary" onClick={onUndo} disabled={!canUndo} data-testid="undo-button">
            Undo
          </button>
          <button className="btn btn-secondary" onClick={onRedo} disabled={!canRedo} data-testid="redo-button">
            Redo
          </button>
          <button className="btn btn-secondary" onClick={onExportScorebook} data-testid="export-scorebook-button">
            Export Scorebook (PDF)
          </button>
          <button className="btn btn-secondary" onClick={() => setBoxScoreOpen(true)} data-testid="box-score-button">
            Box Score
          </button>
          <button className="btn btn-secondary" onClick={onNewGame} data-testid="new-game-button">
            New Game
          </button>
        </div>
        <p className="text-muted">
          Scoring events advance the count, outs, inning, and score. Use Undo/Redo to correct mistakes.
        </p>
        {events.length === 0 ? (
          <p className="text-muted" data-testid="no-events-message">
            No events recorded yet. Use the scoring controls above.
          </p>
        ) : (
          <ul className="event-log-list" data-testid="event-log-list">
            {events.map((event) => (
              <li key={event.id} data-testid={`event-${event.id}`}>
                <span className="event-id">#{event.id}</span>
                <span className="event-type">{event.eventType}</span>
                <span className="event-detail">{JSON.stringify(event.detail)}</span>
              </li>
            ))}
          </ul>
        )}
        {boxScoreOpen && (
          <div className="box-score-overlay" data-testid="box-score-modal" onClick={() => setBoxScoreOpen(false)}>
            <div className="box-score-modal" onClick={(event) => event.stopPropagation()}>
              <div className="box-score-header">
                <h3>Box Score</h3>
                <button
                  className="btn btn-secondary"
                  onClick={() => setBoxScoreOpen(false)}
                  data-testid="close-box-score-button"
                >
                  Close
                </button>
              </div>
              <table className="line-score-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    {inningColumns(boxScore.innings).map((n) => (
                      <th key={n}>{n}</th>
                    ))}
                    <th>R</th>
                    <th>H</th>
                    <th>E</th>
                  </tr>
                </thead>
                <tbody>
                  <LineScoreRow team={boxScore.away} innings={boxScore.innings} />
                  <LineScoreRow team={boxScore.home} innings={boxScore.innings} />
                </tbody>
              </table>
              <div className="batting-tables">
                <BattingTable team={boxScore.away} />
                <BattingTable team={boxScore.home} />
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function inningColumns(total: number): number[] {
  return Array.from({ length: total }, (_, index) => index + 1);
}

function LineScoreRow({ team, innings }: { team: BoxScoreTeam; innings: number }) {
  return (
    <tr data-testid={`line-score-row-${team.name}`}>
      <td>{team.name}</td>
      {inningColumns(innings).map((n) => (
        <td key={n} data-testid={`inning-${team.name}-${n}`}>
          {team.runsByInning[n - 1] ?? 0}
        </td>
      ))}
      <td className="box-score-total" data-testid={`runs-${team.name}`}>
        {team.runs}
      </td>
      <td data-testid={`hits-${team.name}`}>{team.hits}</td>
      <td data-testid={`errors-${team.name}`}>{team.errors}</td>
    </tr>
  );
}

function BattingTable({ team }: { team: BoxScoreTeam }) {
  return (
    <table className="batting-table" data-testid={`batting-table-${team.name}`}>
      <caption>{team.name} Batting</caption>
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
        {team.batting.map((line) => (
          <tr key={line.player}>
            <td>{line.player}</td>
            <td>{line.ab}</td>
            <td>{line.runs}</td>
            <td>{line.hits}</td>
            <td>{line.rbi}</td>
            <td>{line.walks}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
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

function pitchingTeam(engine: EngineGameState): { name: string } {
  return engine.half === 'TOP' ? engine.homeLineup : engine.awayLineup;
}

function scorebookSlots(rows: EngineScorebookRow[]): Array<Record<string, unknown>> {
  return rows.map((row) => ({
    slotIdx: row.slotIdx,
    batterName: row.batterName,
    position: row.position,
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
