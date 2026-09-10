import type { LiveLocalGameState } from './game-state';
import { matchupHands } from './game-shell-helpers';

/**
 * Tracks the optional pitch location and the last manual play so the
 * scoreboard can show a plate result without the watch runner.
 */
export class ManualPlayTracker {
  private json = '';
  private seq = 0;
  private armedZone = 0;

  get playJson(): string {
    return this.json;
  }

  get playSeq(): number {
    return this.seq;
  }

  get zone(): number {
    return this.armedZone;
  }

  /** Arm (1-9) or clear (anything else) the location for the next pitch. */
  arm(value: unknown): void {
    const zone = Math.round(Number(value));
    this.armedZone = Number.isFinite(zone) && zone >= 1 && zone <= 9 ? zone : 0;
  }

  /** Adds the armed pitch location to the event detail and clears the arm. */
  apply(detail: Record<string, unknown>): Record<string, unknown> {
    const zone = this.armedZone;
    this.armedZone = 0;
    return zone ? { ...detail, pitchLocation: { zone } } : detail;
  }

  /** Makes the recorded event the plate scene source. */
  remember(eventType: string, detail: Record<string, unknown>, game: LiveLocalGameState | null): void {
    this.seq += 1;
    this.json = JSON.stringify({
      eventType,
      seq: this.seq,
      ...detail,
      ...(game ? matchupHands(game) : {}),
    });
  }

  /** After undo/redo, show the event now on top. */
  syncTo(game: LiveLocalGameState | null): void {
    const last = game?.events[game.historyIndex - 1];
    if (!last) {
      this.json = '';
      return;
    }
    this.remember(last.eventType, last.detail, game);
  }

  reset(): void {
    this.json = '';
    this.seq = 0;
    this.armedZone = 0;
  }
}
