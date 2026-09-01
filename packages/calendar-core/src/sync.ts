import type {CalEvent, SyncProgress, WriteResult} from './types';

export async function collectEvents(
    loaders: Array<() => Promise<CalEvent[]>>,
    onProgress?: (progress: SyncProgress) => void,
): Promise<CalEvent[]> {
    const all: CalEvent[] = [];
    const total = loaders.length;
    for (let i = 0; i < loaders.length; i++) {
        onProgress?.({phase: 'fetch', done: i, total, label: `source ${i + 1}`});
        const loader = loaders[i];
        if (!loader) continue;
        all.push(...(await loader()));
    }
    onProgress?.({phase: 'fetch', done: total, total});
    return all;
}

async function handleWrite(
    event: CalEvent,
    known: ReadonlySet<string>,
    writeOne: (event: CalEvent) => Promise<WriteResult>,
    state: {succeeded: number; failed: number; newUids: string[]},
): Promise<void> {
    if (known.has(event.uid)) {
        state.succeeded++;
        return;
    }
    const result = await writeOne(event);
    if (result === 'fail') state.failed++;
    else {
        state.succeeded++;
        state.newUids.push(event.uid);
    }
}

function emitProgress(
    event: CalEvent,
    total: number,
    state: {succeeded: number; failed: number},
    onProgress?: (progress: SyncProgress) => void,
): void {
    onProgress?.({
        phase: 'write',
        done: state.succeeded + state.failed,
        total,
        failed: state.failed,
        label: event.title,
    });
}

export async function writeEvents({
    events,
    writtenUids,
    writeOne,
    onProgress,
}: {
    events: readonly CalEvent[];
    writtenUids?: ReadonlySet<string>;
    writeOne: (event: CalEvent) => Promise<WriteResult>;
    onProgress?: (progress: SyncProgress) => void;
}): Promise<{done: number; failed: number; newUids: string[]}> {
    const known = writtenUids ?? new Set<string>();
    const state = {succeeded: 0, failed: 0, newUids: [] as string[]};
    const total = events.length;
    for (const event of events) {
        if (!event) continue;
        await handleWrite(event, known, writeOne, state);
        emitProgress(event, total, state, onProgress);
    }
    return {done: state.succeeded, failed: state.failed, newUids: state.newUids};
}
