import { createGame, reduce } from 'basketball-core';
import type { GameState, ScoringEvent } from 'basketball-core';
import type { LocalGameSetup } from '../local-game/game-types';
import { nextEvent, rngForEngine } from './resolve-play';

const MAX_EVENTS = 700;

export function simulateGame(
    setup: LocalGameSetup,
    seed: number,
    maxEvents = MAX_EVENTS,
): { engine: GameState; events: ScoringEvent[] } {
    let engine = createGame(setup);
    const events: ScoringEvent[] = [];
    while (!engine.over && events.length < maxEvents) {
        const event = nextEvent(engine, rngForEngine(seed, engine, events.length), setup.simRatings);
        engine = reduce(engine, event);
        events.push(event);
    }
    while (!engine.over && events.length < maxEvents + 8) {
        engine = reduce(engine, { type: 'period_end' });
        events.push({ type: 'period_end' });
    }
    return { engine, events };
}
