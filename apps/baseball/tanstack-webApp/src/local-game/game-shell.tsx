import { useEffect, useRef, useState } from 'react';
import type { LocalGameEventRecord, LocalGameSetup } from './game-types';
import { DEFAULT_HOME_LINEUP } from './default-lineups';
import './local-game.css';

interface LocalGameShellProps {
  setup: LocalGameSetup;
  events: LocalGameEventRecord[];
  onEventRecorded: (event: LocalGameEventRecord) => void;
  onNewGame: () => void;
}

const HIT_EVENT_TYPES = new Set(['SINGLE', 'DOUBLE', 'TRIPLE', 'HOME_RUN']);

let eventSequence = 0;

function nextEventId(): number {
  eventSequence += 1;
  return eventSequence;
}

export function LocalGameShell({ setup, events, onEventRecorded, onNewGame }: LocalGameShellProps) {
  const [panelMode, setPanelMode] = useState<'action-grid' | 'step2'>('action-grid');
  const [step2Label, setStep2Label] = useState('');
  const [step2IsHit, setStep2IsHit] = useState(false);
  const [lineupOpen, setLineupOpen] = useState(false);

  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = shellRef.current;
    if (!root) return;

    const record = (eventType: string, event: Event) => {
      onEventRecorded({
        id: nextEventId(),
        eventType,
        occurredAt: new Date().toISOString(),
        detail: (event as CustomEvent).detail ?? {},
      });
    };

    const handleTriggerScoringEvent = (event: Event) => record('trigger-scoring-event', event);
    const handlePitchTypeSelected = (event: Event) => record('pitch-type-selected', event);
    const handleRenderStep2 = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      setStep2Label(String(detail.baseLabel ?? ''));
      setStep2IsHit(HIT_EVENT_TYPES.has(String(detail.eventType)));
      setPanelMode('step2');
      record('render-step2', event);
    };
    const handleLocationSelected = (event: Event) => {
      setPanelMode('action-grid');
      record('location-selected', event);
    };
    const handleCancelStep2 = (event: Event) => {
      setPanelMode('action-grid');
      record('cancel-step2', event);
    };
    const handleOpenLineupSetup = (event: Event) => {
      setLineupOpen(true);
      record('open-lineup-setup-click', event);
    };
    const handleCloseLineupSetup = (event: Event) => {
      setLineupOpen(false);
      record('close-lineup-setup', event);
    };
    const handleSaveLineupSetup = (event: Event) => {
      setLineupOpen(false);
      record('save-lineup-setup', event);
    };

    root.addEventListener('trigger-scoring-event', handleTriggerScoringEvent);
    root.addEventListener('pitch-type-selected', handlePitchTypeSelected);
    root.addEventListener('render-step2', handleRenderStep2);
    root.addEventListener('location-selected', handleLocationSelected);
    root.addEventListener('cancel-step2', handleCancelStep2);
    root.addEventListener('open-lineup-setup-click', handleOpenLineupSetup);
    root.addEventListener('close-lineup-setup', handleCloseLineupSetup);
    root.addEventListener('save-lineup-setup', handleSaveLineupSetup);

    return () => {
      root.removeEventListener('trigger-scoring-event', handleTriggerScoringEvent);
      root.removeEventListener('pitch-type-selected', handlePitchTypeSelected);
      root.removeEventListener('render-step2', handleRenderStep2);
      root.removeEventListener('location-selected', handleLocationSelected);
      root.removeEventListener('cancel-step2', handleCancelStep2);
      root.removeEventListener('open-lineup-setup-click', handleOpenLineupSetup);
      root.removeEventListener('close-lineup-setup', handleCloseLineupSetup);
      root.removeEventListener('save-lineup-setup', handleSaveLineupSetup);
    };
  }, [onEventRecorded]);

  const gameJson = {
    id: 1,
    awayTeam: { id: 2, name: setup.awayTeamName },
    homeTeam: { id: 1, name: setup.homeTeamName },
    awayScore: 0,
    homeScore: 0,
    status: 'IN_PROGRESS',
    gameState: {
      inning: 1,
      half: 'TOP',
      balls: 0,
      strikes: 0,
      outs: 0,
      currentBatterName: DEFAULT_HOME_LINEUP[0]?.batterName ?? 'Current Batter',
      currentPitcherName: 'Current Pitcher',
    },
  };

  const boxScoreJson = {
    lineScore: { awayHits: 0, homeHits: 0, awayErrors: 0, homeErrors: 0 },
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
              game-status="active"
              away-name={setup.awayTeamName}
              home-name={setup.homeTeamName}
              batter-name={DEFAULT_HOME_LINEUP[0]?.batterName ?? 'Current Batter'}
              pitcher-name="Current Pitcher"
              panel-mode={panelMode}
              step2-label={step2Label}
              step2-is-hit={step2IsHit ? '' : undefined}
            />
          </div>
          <div slot="scorebook">
            <baseball-scorebook-grid
              team-name={setup.homeTeamName}
              max-inning={String(setup.innings)}
              slots-json={JSON.stringify(DEFAULT_HOME_LINEUP)}
            />
          </div>
        </baseball-scorer-tab>

        <baseball-lineup-setup
          is-open={lineupOpen ? '' : undefined}
          home-team-name={setup.homeTeamName}
          away-team-name={setup.awayTeamName}
          home-lineup-json={JSON.stringify(DEFAULT_HOME_LINEUP)}
          away-lineup-json={JSON.stringify(DEFAULT_HOME_LINEUP)}
        />
      </div>

      <section className="event-log card" data-testid="local-game-state">
        <div className="event-log-header">
          <h2>Local Game State (placeholder)</h2>
          <button className="btn btn-secondary" onClick={onNewGame} data-testid="new-game-button">
            New Game
          </button>
        </div>
        <p className="text-muted">
          Scoring events are recorded locally below. The rule engine, PDF export, and roster import arrive in later
          phases.
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
      </section>
    </main>
  );
}
