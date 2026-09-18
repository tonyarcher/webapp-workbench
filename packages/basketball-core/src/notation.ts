import {formatClock} from './clock';
import {findPlayer} from './lineup';
import {periodLabel, getRulebook} from './rulebook';
import {teamSide} from './reduce-helpers';
import type {GameState, ScoringEvent} from './types';

function playerName(game: GameState, playerId: string): string {
    const home = findPlayer(game.home.roster, playerId);
    if (home) return home.name;
    const away = findPlayer(game.away.roster, playerId);
    return away?.name ?? playerId;
}

function teamName(game: GameState, team: 'home' | 'away'): string {
    return teamSide(game, team).name;
}

export function describeEvent(event: ScoringEvent, game: GameState): string {
    return describeLive(event, game) ?? describeAdmin(event, game);
}

function describeLive(event: ScoringEvent, game: GameState): string | null {
    if (event.type === 'shot') return describeShot(event, game);
    if (event.type === 'free_throw') return `${playerName(game, event.shooterId)} FT ${event.made ? 'make' : 'miss'}`;
    if (event.type === 'rebound') return `${playerName(game, event.playerId)} ${event.offensive ? 'OREB' : 'DREB'}`;
    if (event.type === 'turnover') return describeTurnover(event, game);
    if (event.type === 'foul') return `${playerName(game, event.playerId)} foul`;
    return null;
}

function describeAdmin(event: ScoringEvent, game: GameState): string {
    if (event.type === 'substitution') {
        return `${teamName(game, event.team)} sub ${playerName(game, event.inId)} for ${playerName(game, event.outId)}`;
    }
    if (event.type === 'timeout') return `${teamName(game, event.team)} timeout`;
    if (event.type === 'period_end') return describePeriodEnd(game);
    if (event.type === 'set_clock') return `Clock ${formatClock(event.clock.gameClockSeconds)}`;
    if (event.type === 'set_lineup') return `${teamName(game, event.team)} lineup`;
    return event.type;
}

function describeShot(event: Extract<ScoringEvent, {type: 'shot'}>, game: GameState): string {
    const result = event.made ? 'make' : 'miss';
    const assist = event.made && event.assistId ? ` (${playerName(game, event.assistId)})` : '';
    return `${playerName(game, event.shooterId)} ${result}${assist}`;
}

function describeTurnover(event: Extract<ScoringEvent, {type: 'turnover'}>, game: GameState): string {
    if (!event.stealPlayerId) return `${playerName(game, event.playerId)} turnover`;
    return `${playerName(game, event.stealPlayerId)} steal (${playerName(game, event.playerId)})`;
}

function describePeriodEnd(game: GameState): string {
    const rb = getRulebook(game.rulebookId);
    return `End ${periodLabel(game.clock.period, rb.regulationPeriods)}`;
}
