import { useCallback, useState } from 'react';
import '@baseball/web-components/dist/web-components.js';
import { LocalGameSetupScreen } from './local-game/game-setup-screen';
import { LocalGameShell } from './local-game/game-shell';
import type { LocalGameEventRecord, LocalGameSetup, LocalGameState } from './local-game/game-types';

function createEmptyGameState(): LocalGameState {
  return { setup: null, events: [] };
}

export default function App() {
  const [gameState, setGameState] = useState<LocalGameState>(createEmptyGameState);

  const handleStartGame = useCallback((setup: LocalGameSetup) => {
    setGameState({ setup, events: [] });
  }, []);

  const handleNewGame = useCallback(() => {
    setGameState(createEmptyGameState());
  }, []);

  const handleEventRecorded = useCallback((record: LocalGameEventRecord) => {
    setGameState((previous) => ({ ...previous, events: [...previous.events, record] }));
  }, []);

  if (!gameState.setup) {
    return <LocalGameSetupScreen onStartGame={handleStartGame} />;
  }

  return (
    <LocalGameShell
      setup={gameState.setup}
      events={gameState.events}
      onEventRecorded={handleEventRecorded}
      onNewGame={handleNewGame}
    />
  );
}
