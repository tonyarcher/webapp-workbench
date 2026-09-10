import {createGame, reduce} from 'football-core';
import type {GameSetup, GameState, ScoringEvent} from 'football-core';
import {nextEvent, rngForEngine} from './resolve-play';

const MAX_EVENTS = 450;

export function simulateGame(setup: GameSetup, seed: number): {engine: GameState; events: ScoringEvent[]} {
    let engine = createGame(setup);
    const events: ScoringEvent[] = [];
    while (!engine.over && events.length < MAX_EVENTS) {
        const event = nextEvent(engine, rngForEngine(seed, engine, events.length));
        engine = reduce(engine, event);
        events.push(event);
    }
    while (!engine.over && events.length < MAX_EVENTS + 12) {
        engine = reduce(engine, {type: 'period_end'});
        events.push({type: 'period_end'});
    }
    return {engine, events};
}
