import {boxRows, findPlayer, formatMinutes} from 'basketball-core';
import type {GameState, PlayerStatLine, TeamId} from 'basketball-core';

export function boxScoreText(engine: GameState, team: TeamId, teamName: string): string {
    const rows = boxRows(engine, team);
    const lines = rows.map((row) => formatRow(engine, team, row));
    return [`${teamName}`, 'Player  MIN  PTS  FG  3P  FT  AST  REB', ...lines].join('\n');
}

function formatRow(engine: GameState, team: TeamId, row: PlayerStatLine): string {
    const roster = team === 'home' ? engine.home.roster : engine.away.roster;
    const player = findPlayer(roster, row.playerId);
    const name = player === undefined ? row.playerId : player.name;
    const reb = row.orb + row.drb;
    return [
        name.padEnd(14, ' ').slice(0, 14),
        formatMinutes(row.seconds).padStart(5, ' '),
        String(row.pts).padStart(4, ' '),
        `${row.fgm}-${row.fga}`.padStart(6, ' '),
        `${row.tpm}-${row.tpa}`.padStart(5, ' '),
        `${row.ftm}-${row.fta}`.padStart(5, ' '),
        String(row.ast).padStart(4, ' '),
        String(reb).padStart(4, ' '),
    ].join(' ');
}
