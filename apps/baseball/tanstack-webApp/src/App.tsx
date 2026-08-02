import { useCallback, useEffect, useMemo, useState } from 'react';
import '@baseball/web-components/dist/web-components.js';
import { LocalGameSetupScreen } from './local-game/game-setup-screen';
import { LocalGameShell } from './local-game/game-shell';
import { createGame, reduceGame } from './local-game/rule-engine';
import { clearGameState, loadGameState, persistGameState } from './local-game/save-state';
import type { EngineGameState, EngineInitOptions, ScoringEvent, ScoringEventType } from './local-game/rule-engine';
import type { LocalGameEventRecord, LocalGameSetup } from './local-game/game-types';

export interface LiveLocalGameState {
  setup: LocalGameSetup;
  engine: EngineGameState;
  events: LocalGameEventRecord[];
}

const ALL_ENGINE_EVENT_TYPES: ScoringEventType[] = [
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
];

export default function App() {
  const [game, setGame] = useState<LiveLocalGameState | null>(() => loadGameState());

  useEffect(() => {
    if (game) {
      persistGameState(game);
    } else {
      clearGameState();
    }
  }, [game]);

  const handleStartGame = useCallback((setup: LocalGameSetup) => {
    const options: EngineInitOptions = {
      homeName: setup.homeTeamName,
      awayName: setup.awayTeamName,
      homeLineup: [
        { batterName: 'Nico Hoerner', position: '2B' },
        { batterName: 'Dansby Swanson', position: 'SS' },
        { batterName: 'Ian Happ', position: 'LF' },
        { batterName: 'Seiya Suzuki', position: 'RF' },
        { batterName: 'Cody Bellinger', position: 'CF' },
        { batterName: 'Christopher Morel', position: 'DH' },
        { batterName: 'Miguel Amaya', position: 'C' },
        { batterName: 'Michael Busch', position: '1B' },
        { batterName: 'Patrick Wisdom', position: '3B' },
      ],
      awayLineup: [
        { batterName: 'Brendan Donovan', position: '2B' },
        { batterName: 'Paul Goldschmidt', position: '1B' },
        { batterName: 'Nolan Arenado', position: '3B' },
        { batterName: 'Willson Contreras', position: 'DH' },
        { batterName: 'Lars Nootbaar', position: 'CF' },
        { batterName: 'Alec Burleson', position: 'LF' },
        { batterName: 'Jordan Walker', position: 'RF' },
        { batterName: 'Tommy Edman', position: 'SS' },
        { batterName: 'Iván Herrera', position: 'C' },
      ],
      totalInnings: setup.innings,
    };
    setGame({ setup, engine: createGame(options), events: [] });
  }, []);

  const handleEventRecorded = useCallback((record: LocalGameEventRecord) => {
    setGame((previous) => {
      if (!previous) return previous;
      const { engine, events } = previous;
      const nextEngine = reduceEngineState(engine, record);
      return { ...previous, engine: nextEngine, events: [...events, record] };
    });
  }, []);

  const handleNewGame = useCallback(() => {
    setGame(null);
  }, []);

  const content = useMemo(() => {
    if (!game) {
      return <LocalGameSetupScreen onStartGame={handleStartGame} />;
    }
    return (
      <LocalGameShell
        setup={game.setup}
        engine={game.engine}
        events={game.events}
        onEventRecorded={handleEventRecorded}
        onNewGame={handleNewGame}
      />
    );
  }, [game, handleStartGame, handleEventRecorded, handleNewGame]);

  return content;
}

function reduceEngineState(engine: EngineGameState, record: LocalGameEventRecord): EngineGameState {
  const scoringEvent = toScoringEvent(record);
  if (!scoringEvent) return engine;
  return reduceGame(engine, scoringEvent);
}

function toScoringEvent(record: LocalGameEventRecord): ScoringEvent | null {
  const eventType = record.eventType as ScoringEventType;
  if (!ALL_ENGINE_EVENT_TYPES.includes(eventType)) return null;
  const base = Number(record.detail?.base ?? record.detail?.position ?? NaN);
  return Number.isNaN(base) ? { type: eventType } : { type: eventType, base };
}
