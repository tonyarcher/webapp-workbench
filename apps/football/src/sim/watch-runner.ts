import type {PlayFamily, PlayInput, ScoringEvent} from 'football-core';
import type {LiveLocalGameState} from '../local-game/game-state';
import {delayForPlay, PlaybackClock} from './playback';
import {nextEvent, rngForEngine} from './resolve-play';

/** Matches simulateGame: a long game can need more than 400 events to finish. */
const MAX_EVENTS = 450;
const MAX_WIND_DOWN = 12;

/** Session state for watch mode. The game shell owns the async loop. */
export class WatchRunner {
    readonly clock = new PlaybackClock();
    speed = 1;
    animations = true;
    lastLabel = '';
    activeEvent: ScoringEvent | null = null;

    get playing(): boolean {
        return this.clock.playing;
    }

    pause(): void {
        this.clock.pause();
    }

    reset(): void {
        this.lastLabel = '';
        this.activeEvent = null;
        this.pause();
    }

    takeEvent(game: LiveLocalGameState): ScoringEvent | null {
        if (game.setup.mode !== 'watch' || game.engine.over) return null;
        const event = this.pickEvent(game);
        if (!event) return null;
        this.lastLabel = labelFor(event);
        this.activeEvent = event;
        return event;
    }

    delayMs(event: ScoringEvent): number {
        const family = event.type === 'play' ? event.input.family : event.type;
        return delayForPlay(family, this.speed, this.animations);
    }

    private pickEvent(game: LiveLocalGameState): ScoringEvent | null {
        if (game.historyIndex < MAX_EVENTS) {
            return nextEvent(game.engine, rngForEngine(game.setup.simSeed ?? 1, game.engine, game.historyIndex));
        }
        return game.historyIndex < MAX_EVENTS + MAX_WIND_DOWN ? {type: 'period_end'} : null;
    }
}

export function watchLoopAlive(connected: boolean, isWatch: boolean, over: boolean): boolean {
    return connected && isWatch && !over;
}

export function watchBadge(over: boolean, playing: boolean): string {
    if (over) return 'FINAL';
    return playing ? 'SIMULATING' : 'PAUSED';
}

export function highlightLabel(event: ScoringEvent | null): string | null {
    if (!event) return null;
    if (event.type === 'period_end') return 'Period end';
    if (event.type === 'timeout') return event.team === 'home' ? 'Timeout home' : 'Timeout away';
    if (event.type !== 'play') return null;
    return familyLabel(event.input) ?? resultLabel(event.input);
}

function familyLabel(input: PlayInput): string | null {
    if (input.family === 'kickoff') return kickoffLabel(input);
    return scoreAttemptLabel(input) ?? plainFamilyLabel(input.family);
}

function scoreAttemptLabel(input: PlayInput): string | null {
    if (input.family === 'extra_point') return input.extraPointMade ? 'XP good' : 'XP miss';
    if (input.family === 'two_point') return input.twoPointMade ? '2pt good' : '2pt miss';
    if (input.family === 'field_goal') return input.fieldGoalMade ? 'FG good' : 'FG miss';
    return null;
}

function plainFamilyLabel(family: PlayFamily): string | null {
    if (family === 'punt') return 'Punt';
    if (family === 'kneel') return 'Kneel';
    if (family === 'spike') return 'Spike';
    return null;
}

function kickoffLabel(input: PlayInput): string {
    if (input.touchback) return 'Kickoff TB';
    if (input.outOfBounds) return 'Kickoff OOB';
    return 'Kickoff return';
}

function resultLabel(input: PlayInput): string {
    if (input.touchdown) return 'TD';
    if (input.interception) return 'INT';
    if (input.fumbleLost) return 'Fumble lost';
    if (input.fumbleOwn) return 'Fumble own';
    if (input.sack) return 'Sack';
    if (input.scramble) return 'Scramble';
    return scrimmageLabel(input);
}

function scrimmageLabel(input: PlayInput): string {
    if (input.incomplete) return 'Incomplete';
    return isDropback(input.concept) ? 'Complete' : 'Run';
}

function isDropback(concept: PlayInput['concept']): boolean {
    return concept === 'dropback' || concept === 'play_action' || concept === 'screen';
}

function labelFor(event: ScoringEvent): string {
    return highlightLabel(event) ?? event.type;
}
