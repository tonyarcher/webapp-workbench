import {formatClock} from './clock';
import type {Play, PlayFamily, Situation, TeamId} from './types';

const DOWN_ORD = ['1st', '2nd', '3rd', '4th'] as const;

export function formatYardline(yardline100: number, possession: TeamId, homeName: string, awayName: string): string {
    if (yardline100 <= 0) return 'end zone';
    if (yardline100 >= 100) return 'own end zone';
    const possName = possession === 'home' ? homeName : awayName;
    const defName = possession === 'home' ? awayName : homeName;
    if (yardline100 === 50) return '50';
    if (yardline100 > 50) return `${possName} ${100 - yardline100}`;
    return `${defName} ${yardline100}`;
}

export function formatDownDistance(situation: Situation, homeName: string, awayName: string): string {
    const down = DOWN_ORD[situation.down - 1];
    const dist = situation.distance >= situation.yardline100 ? 'Goal' : String(situation.distance);
    const at = formatYardline(situation.yardline100, situation.possession, homeName, awayName);
    return `${down} & ${dist} at ${at}`;
}

function specialTeamsLine(play: Play, clock: string, yardWord: string): string | null {
    const family: PlayFamily = play.call.family;
    if (family === 'kickoff') return `(${clock}) Kickoff`;
    if (family === 'extra_point') {
        return `(${clock}) Extra point ${play.result.scoring === 'extra_point' ? 'good' : 'no good'}`;
    }
    if (family === 'two_point') {
        return `(${clock}) Two-point ${play.result.scoring === 'two_point' ? 'good' : 'no good'}`;
    }
    if (family === 'punt') return `(${clock}) Punt ${yardWord}`;
    if (family === 'field_goal') {
        return `(${clock}) Field goal ${play.result.scoring === 'field_goal' ? 'good' : 'no good'}`;
    }
    return null;
}

function scoringLine(play: Play, clock: string, yardWord: string): string | null {
    if (play.result.scoring !== 'touchdown') return null;
    if (play.result.turnover === 'interception') return `(${clock}) Interception touchdown ${yardWord}`;
    return `(${clock}) Touchdown ${yardWord}`;
}

function scrimmageLine(play: Play, clock: string, yardWord: string, homeName: string, awayName: string): string {
    const scored = scoringLine(play, clock, yardWord);
    if (scored) return scored;
    if (play.result.incomplete) return `(${clock}) Incomplete pass`;
    if (play.result.turnover === 'interception') return `(${clock}) Interception`;
    if (play.result.turnover === 'fumble') return `(${clock}) Fumble lost ${yardWord}`;
    if (play.result.sack) return `(${clock}) Sack ${yardWord}`;
    if (play.call.family === 'kneel') return `(${clock}) Kneel ${yardWord}`;
    if (play.call.family === 'spike') return `(${clock}) Spike`;
    const concept = play.call.concept === 'unknown' ? play.call.family : play.call.concept.replaceAll('_', ' ');
    return `(${clock}) ${concept} ${yardWord} · ${formatDownDistance(play.situation, homeName, awayName)}`;
}

export function describePlay(play: Play, homeName: string, awayName: string): string {
    const clock = formatClock(play.clock.snap);
    const yardWord = `${play.result.yards >= 0 ? '+' : ''}${play.result.yards}`;
    return specialTeamsLine(play, clock, yardWord) ?? scrimmageLine(play, clock, yardWord, homeName, awayName);
}
