import type { LiveLocalGameState } from './game-state';
import { rosterFromLineup } from '../sim/generate-roster';
import { matchupFromGame } from '../sim/matchup';
import { delayForPlay, PlaybackClock } from '../sim/playback';
import { mulberry32 } from '../sim/rng';
import { nextPlay } from '../sim/resolve-play';
import { rngForEngine } from '../sim/simulate-game';
import type { ResolvedPlay, SimRoster } from '../sim/types';

/** Session state for watch mode. The game shell owns the async loop. */
export class WatchRunner {
  readonly clock = new PlaybackClock();
  speed = 1;
  animations = true;
  activePlayJson = '';
  playSeq = 0;
  playDurationMs = 4000;

  get playing(): boolean {
    return this.clock.playing;
  }

  pause(): void {
    this.clock.pause();
  }

  reset(): void {
    this.activePlayJson = '';
    this.playSeq = 0;
    this.playDurationMs = 4000;
    this.pause();
  }

  takePlay(game: LiveLocalGameState): ResolvedPlay | null {
    if (game.setup.mode !== 'watch' || game.engine.over) return null;
    const rosters = rostersOf(game);
    const play = nextPlay(
      game.engine,
      matchupFromGame(game.engine, rosters.home, rosters.away),
      rngForEngine(game.setup.simSeed ?? 1, game.engine, game.historyIndex),
    );
    this.playSeq += 1;
    this.playDurationMs = delayForPlay(play.type, this.speed, this.animations);
    this.activePlayJson = JSON.stringify({ eventType: play.type, seq: this.playSeq, ...play.detail });
    return play;
  }
}

export function watchLoopAlive(connected: boolean, isWatch: boolean, over: boolean): boolean {
  return connected && isWatch && !over;
}

export function rostersOf(game: LiveLocalGameState): { home: SimRoster; away: SimRoster } {
  if (game.setup.homeRoster && game.setup.awayRoster) {
    return { home: game.setup.homeRoster, away: game.setup.awayRoster };
  }
  const random = mulberry32(game.setup.simSeed ?? 1);
  return {
    away: rosterFromLineup(random, game.setup.awayTeamName, game.setup.awayLineup ?? [], game.setup.awayPitcherName ?? ''),
    home: rosterFromLineup(random, game.setup.homeTeamName, game.setup.homeLineup ?? [], game.setup.homePitcherName ?? ''),
  };
}

export function watchBadge(over: boolean, playing: boolean): string {
  if (over) return 'FINAL';
  return playing ? 'SIMULATING' : 'PAUSED';
}

export function activePlayLabel(activePlayJson: string): string {
  try {
    const parsed = JSON.parse(activePlayJson) as { eventType?: string };
    return typeof parsed.eventType === 'string' ? parsed.eventType.replaceAll('_', ' ') : '';
  } catch {
    return '';
  }
}
