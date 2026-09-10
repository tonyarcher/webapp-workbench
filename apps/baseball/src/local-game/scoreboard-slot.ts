import { html } from 'lit';
import type { LiveLocalGameState } from './game-state';
import { defendingTeamName, defenseFielders } from './game-shell-helpers';

export function renderScoreboardSlot(model: {
  game: LiveLocalGameState;
  gameJson: unknown;
  boxScoreJson: unknown;
  playing: boolean;
  animations: boolean;
  activePlayJson: string;
  playSeq: number;
  playDurationMs: number;
  interactive: boolean;
  armedLocation: number;
}) {
  return html`
    ${renderScoreboard(model)}
    ${renderDefense(model)}
  `;
}

function renderScoreboard(model: Parameters<typeof renderScoreboardSlot>[0]) {
  return html`
    <baseball-scoreboard
      game-json=${JSON.stringify(model.gameJson)}
      box-score-json=${JSON.stringify(model.boxScoreJson)}
      sim-playing=${model.playing ? 'true' : 'false'}
      animations=${model.animations ? 'true' : 'false'}
      active-play-json=${model.activePlayJson}
      play-seq=${model.playSeq}
      play-duration-ms=${model.playDurationMs}
      ?interactive=${model.interactive}
      armed-location=${model.armedLocation}
    ></baseball-scoreboard>
  `;
}

function renderDefense(model: Parameters<typeof renderScoreboardSlot>[0]) {
  return html`
    <baseball-defense-diagram
      defending-team=${defendingTeamName(model.game.engine)}
      fielders-json=${JSON.stringify(defenseFielders(model.game.engine))}
      active-play-json=${model.activePlayJson}
      play-seq=${model.playSeq}
      play-duration-ms=${model.playDurationMs}
      animations=${model.animations ? 'true' : 'false'}
    ></baseball-defense-diagram>
  `;
}
