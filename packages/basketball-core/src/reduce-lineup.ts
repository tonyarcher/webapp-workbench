import {applySub, isValidOnCourt, rosterIds} from './lineup';
import {creditStints, startStint, stopStint, teamSide, withTeam} from './reduce-helpers';
import {stampFromClock} from './clock';
import type {GameState, SetLineupEvent, SubstitutionEvent} from './types';

export function applySubstitution(game: GameState, event: SubstitutionEvent): GameState {
    const side = teamSide(game, event.team);
    if (!rosterIds(side.roster).has(event.inId)) return game;
    const nextOnCourt = applySub(side.onCourt, event.outId, event.inId);
    if (!nextOnCourt) return game;
    let next = creditStints(game, stampFromClock(game.clock));
    next = stopStint(next, event.outId);
    next = withTeam(next, event.team, {...teamSide(next, event.team), onCourt: nextOnCourt});
    return startStint(next, event.inId);
}

export function applySetLineup(game: GameState, event: SetLineupEvent): GameState {
    const side = teamSide(game, event.team);
    if (!isValidOnCourt(event.onCourt, side.roster)) return game;
    let next = creditStints(game, stampFromClock(game.clock));
    for (const id of side.onCourt) next = stopStint(next, id);
    next = withTeam(next, event.team, {...teamSide(next, event.team), onCourt: [...event.onCourt]});
    for (const id of event.onCourt) next = startStint(next, id);
    return next;
}
