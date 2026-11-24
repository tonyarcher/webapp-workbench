import './test-setup';
import { expect } from '@esm-bundle/chai';
import { clearClientDb, closeDb, getDb } from '../src/db/db-base';

function openCurrentDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('times-up', 5);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

describe('client database clearing', () => {
    it('makes database opens wait for an in-progress clear', async () => {
        const original = globalThis.BroadcastChannel;
        class QuietChannel {
            onmessage: ((event: MessageEvent) => void) | null = null;
            postMessage(): void {}
        }
        Object.defineProperty(globalThis, 'BroadcastChannel', { value: QuietChannel, configurable: true });
        try {
            const clearing = clearClientDb();
            const opening = getDb();
            await clearing;
            const db = await opening;
            expect(db.name).to.equal('times-up');
            await closeDb();
        } finally {
            Object.defineProperty(globalThis, 'BroadcastChannel', { value: original, configurable: true });
            await closeDb();
        }
    });

    it('rejects when another connection blocks deletion', async () => {
        const original = globalThis.BroadcastChannel;
        Object.defineProperty(globalThis, 'BroadcastChannel', { value: undefined, configurable: true });
        try {
            await getDb();
            await closeDb();
            const blocker = await openCurrentDatabase();
            let failure: Error | undefined;
            try {
                await clearClientDb();
            } catch (err) {
                failure = err instanceof Error ? err : new Error(String(err));
            }
            expect(failure?.message).to.contain('Close other Times Up tabs');
            blocker.close();
            await clearClientDb();
        } finally {
            Object.defineProperty(globalThis, 'BroadcastChannel', { value: original, configurable: true });
            await closeDb();
        }
    });
});
