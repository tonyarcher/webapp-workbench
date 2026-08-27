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
    let succeeded = 0;
    let failed = 0;
    const newUids: string[] = [];
    const total = events.length;
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        if (!event) continue;
        if (known.has(event.uid)) {
            succeeded++;
        } else {
            const result = await writeOne(event);
            if (result === 'fail') failed++;
            else {
                succeeded++;
                newUids.push(event.uid);
            }
        }
        const processed = succeeded + failed;
        onProgress?.({
            phase: 'write',
            done: processed,
            total,
            failed,
            label: event.title,
        });
    }
    return {done: succeeded, failed, newUids};
}
