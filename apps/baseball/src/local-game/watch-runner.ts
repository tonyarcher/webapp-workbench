import type { LiveLocalGameState } from './game-state';
import { rosterFromLineup } from '../sim/generate-roster';
import { matchupFromGame } from '../sim/matchup';
import { delayForPlay, PlaybackClock, yieldDelay } from '../sim/playback';
import { mulberry32 } from '../sim/rng';
import { nextPlay } from '../sim/resolve-play';
import { rngForEngine } from '../sim/simulate-game';
import type { SimRoster } from '../sim/types';

export class WatchRunner {
  readonly clock = new PlaybackClock();
  speed = 1;
  animations = true;
  activePlayJson = '';
  private autoStarted = false;

  constructor(
    private readonly deps: {
      getGame: () => LiveLocalGameState | null;
      record: (type: string, detail: Record<string, unknown>) => void;
      flush: () => void;
      onChange: () => void;
    }
  ) {}

  get playing(): boolean {
    return this.clock.playing;
  }

  maybeAutoStart(isWatch: boolean): void {
    const game = this.deps.getGame();
    if (this.autoStarted || !isWatch || !game) return;
    if (game.engine.over || game.historyIndex > 0) return;
    this.autoStarted = true;
    queueMicrotask(() => {
      void this.play(isWatch);
    });
  }

  async play(isWatch: boolean): Promise<void> {
    if (!isWatch || this.clock.playing) return;
    await this.clock.play(async () => this.step());
    this.deps.flush();
    this.deps.onChange();
  }

  pause(): void {
    this.clock.pause();
    this.deps.flush();
    this.deps.onChange();
  }

  reset(): void {
    this.autoStarted = false;
    this.activePlayJson = '';
    this.pause();
  }

  private async step(): Promise<boolean> {
    const game = this.deps.getGame();
    if (!game || game.engine.over) return false;
    const rosters = rostersOf(game);
    const play = nextPlay(
      game.engine,
      matchupFromGame(game.engine, rosters.home, rosters.away),
      rngForEngine(game.setup.simSeed ?? 1, game.engine, game.historyIndex)
    );
    this.activePlayJson = JSON.stringify({ eventType: play.type, ...play.detail });
    this.deps.record(play.type, play.detail);
    await yieldDelay(delayForPlay(play.type, this.speed, this.animations));
    return !this.deps.getGame()?.engine.over;
  }
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
