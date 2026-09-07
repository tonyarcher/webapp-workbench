import {createGame, reduce, SCORING_EVENT_TYPES} from 'football-core';
import type {ScoringEvent} from 'football-core';
import type {LiveLocalGameState} from './game-state';
import type {LocalGameEventRecord, LocalGameSetup} from './game-types';
import {clearGameState, loadGameState, saveGameState} from './save-state';

export class GameStore {
    private state: LiveLocalGameState | null = null;
    private readonly listeners = new Set<(state: LiveLocalGameState | null) => void>();
    private nextEventId = 1;
    private persistChain: Promise<void> = Promise.resolve();

    get canUndo(): boolean {
        return this.state != null && this.state.historyIndex > 0;
    }

    get canRedo(): boolean {
        return this.state != null && this.state.historyIndex < this.state.events.length;
    }

    current(): LiveLocalGameState | null {
        return this.state;
    }

    subscribe(callback: (state: LiveLocalGameState | null) => void): () => void {
        this.listeners.add(callback);
        callback(this.state);
        return () => {
            this.listeners.delete(callback);
        };
    }

    async hydrate(): Promise<void> {
        const saved = await loadGameState();
        if (saved) {
            this.nextEventId = saved.events.reduce((max, row) => Math.max(max, row.id), 0) + 1;
        }
        this.setState(saved, false);
    }

    startGame(setup: LocalGameSetup): void {
        this.nextEventId = 1;
        this.setState({
            setup,
            engine: createGame(setup),
            historyIndex: 0,
            events: [],
        });
    }

    recordEvent(event: ScoringEvent, occurredAt = new Date()): void {
        const previous = this.state;
        if (!previous) return;
        if (!(SCORING_EVENT_TYPES as readonly string[]).includes(event.type)) return;
        const record: LocalGameEventRecord = {
            id: this.nextEventId,
            occurredAt: occurredAt.toISOString(),
            event,
        };
        this.nextEventId += 1;
        this.setState({
            setup: previous.setup,
            engine: reduce(previous.engine, event),
            historyIndex: previous.historyIndex + 1,
            events: [...previous.events.slice(0, previous.historyIndex), record],
        });
    }

    undo(): void {
        this.applyHistory((this.state?.historyIndex ?? 0) - 1);
    }

    redo(): void {
        this.applyHistory((this.state?.historyIndex ?? 0) + 1);
    }

    newGame(): void {
        this.setState(null);
    }

    flushPersist(): Promise<void> {
        return this.persistChain;
    }

    private applyHistory(historyIndex: number): void {
        const state = this.state;
        if (!state) return;
        if (historyIndex < 0 || historyIndex > state.events.length) return;
        let engine = createGame(state.setup);
        for (const record of state.events.slice(0, historyIndex)) {
            engine = reduce(engine, record.event);
        }
        this.setState({...state, engine, historyIndex});
    }

    private setState(state: LiveLocalGameState | null, persist = true): void {
        this.state = state;
        for (const listener of this.listeners) listener(state);
        if (!persist) return;
        this.persistChain = state ? saveGameState(state) : clearGameState();
    }
}
