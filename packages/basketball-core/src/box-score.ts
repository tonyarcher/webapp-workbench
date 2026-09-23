import { teamSide } from './reduce-helpers';
import { emptyStat } from './reduce-helpers';
import type { GameState, PlayerStatLine, TeamId } from './types';

export function boxRows(game: GameState, team: TeamId): PlayerStatLine[] {
    return teamSide(game, team).roster.map((player) => game.stats[player.id] ?? emptyStat(player.id));
}

export function formatMinutes(seconds: number): string {
    const clamped = Math.max(0, Math.round(seconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
