import type {ScoringEvent} from 'basketball-core';
import type {LiveLocalGameState} from '../local-game/game-state';
import {delayForPlay, PlaybackClock} from './playback';
import {nextEvent, rngForEngine} from './resolve-play';

const MAX_EVENTS = 700;
const MAX_WIND_DOWN = 8;

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
        this.lastLabel = event.type;
        this.activeEvent = event;
        return event;
    }

    delayMs(event: ScoringEvent): number {
        return delayForPlay(event.type, this.speed, this.animations);
    }

    private pickEvent(game: LiveLocalGameState): ScoringEvent | null {
        if (game.historyIndex < MAX_EVENTS) {
            return nextEvent(
                game.engine,
                rngForEngine(game.setup.simSeed ?? 1, game.engine, game.historyIndex),
                game.setup.simRatings,
            );
        }
        return game.historyIndex < MAX_EVENTS + MAX_WIND_DOWN ? {type: 'period_end'} : null;
    }
}

export function watchLoopAlive(connected: boolean, isWatch: boolean, over: boolean): boolean {
    return connected && isWatch && !over;
}

export function watchBadge(over: boolean, playing: boolean): string {
    if (over) return 'FINAL';
    return playing ? 'LIVE' : 'PAUSED';
}
