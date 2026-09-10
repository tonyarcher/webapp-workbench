import type {PlayFamily, PlayInput, ScoringEvent} from 'football-core';
import type {LiveLocalGameState} from '../local-game/game-state';
import {delayForPlay, PlaybackClock, yieldDelay} from './playback';
import {nextEvent, rngForEngine} from './resolve-play';

/** Matches simulateGame: a long game can need more than 400 events to finish. */
const MAX_EVENTS = 450;
const MAX_WIND_DOWN = 12;

export class WatchRunner {
    readonly clock = new PlaybackClock();
    speed = 1;
    animations = true;
    lastLabel = '';
    activeEvent: ScoringEvent | null = null;
    private autoStarted = false;

    constructor(
        private readonly deps: {
            getGame: () => LiveLocalGameState | null;
            record: (event: ScoringEvent) => void;
            flush: () => void;
            onChange: () => void;
            /** Injectable so tests can drain long games without real timers. */
            wait?: (ms: number) => Promise<void>;
        },
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
        this.lastLabel = '';
        this.activeEvent = null;
        this.pause();
    }

    private async step(): Promise<boolean> {
        const game = this.deps.getGame();
        if (!game || game.engine.over) return false;
        const event = this.pickEvent(game);
        if (!event) return false;
        this.lastLabel = labelFor(event);
        this.activeEvent = event;
        this.deps.record(event);
        const family = event.type === 'play' ? event.input.family : event.type;
        await (this.deps.wait ?? yieldDelay)(delayForPlay(family, this.speed, this.animations));
        return !this.deps.getGame()?.engine.over;
    }

    /** Normal events up to the cap, then forced period ends like simulateGame. */
    private pickEvent(game: LiveLocalGameState): ScoringEvent | null {
        if (game.historyIndex < MAX_EVENTS) {
            return nextEvent(game.engine, rngForEngine(game.setup.simSeed ?? 1, game.engine, game.historyIndex));
        }
        return game.historyIndex < MAX_EVENTS + MAX_WIND_DOWN ? {type: 'period_end'} : null;
    }
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
