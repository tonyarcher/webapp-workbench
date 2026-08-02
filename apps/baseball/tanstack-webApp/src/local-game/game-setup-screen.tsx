import { useState } from 'react';
import type { FormEvent } from 'react';
import { DEFAULT_GAME_SETUP } from './game-types';
import type { LocalGameSetup } from './game-types';
import './local-game.css';

interface LocalGameSetupScreenProps {
  onStartGame: (setup: LocalGameSetup) => void;
}

export function LocalGameSetupScreen({ onStartGame }: LocalGameSetupScreenProps) {
  const [homeTeamName, setHomeTeamName] = useState(DEFAULT_GAME_SETUP.homeTeamName);
  const [awayTeamName, setAwayTeamName] = useState(DEFAULT_GAME_SETUP.awayTeamName);
  const [innings, setInnings] = useState(DEFAULT_GAME_SETUP.innings);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onStartGame({
      homeTeamName: homeTeamName.trim() || DEFAULT_GAME_SETUP.homeTeamName,
      awayTeamName: awayTeamName.trim() || DEFAULT_GAME_SETUP.awayTeamName,
      innings: Math.min(9, Math.max(1, innings || DEFAULT_GAME_SETUP.innings)),
    });
  };

  return (
    <main className="local-setup">
      <div className="card">
        <h1>⚾ Grand Slam Baseball — Local Game Setup</h1>
        <p className="text-muted">
          Everything runs entirely in your browser. No server or API required.
        </p>
        <form className="local-setup-form" onSubmit={handleSubmit}>
          <label htmlFor="home-team-input">Home Team</label>
          <input
            id="home-team-input"
            data-testid="home-team-input"
            value={homeTeamName}
            onChange={(event) => setHomeTeamName(event.target.value)}
          />
          <label htmlFor="away-team-input">Away Team</label>
          <input
            id="away-team-input"
            data-testid="away-team-input"
            value={awayTeamName}
            onChange={(event) => setAwayTeamName(event.target.value)}
          />
          <label htmlFor="innings-input">Innings</label>
          <input
            id="innings-input"
            data-testid="innings-input"
            type="number"
            min={1}
            max={9}
            value={innings}
            onChange={(event) => setInnings(Number(event.target.value))}
          />
          <button type="submit" className="btn btn-primary" data-testid="start-game-button">
            Start Local Game
          </button>
        </form>
      </div>
    </main>
  );
}
