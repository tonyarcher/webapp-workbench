import './test-setup';
import { expect } from '@esm-bundle/chai';
import {
    hasPersistentLocalClearFailure,
    recoverLocalDataClear,
    type AppShellAuthHost,
} from '../src/web-components/app-shell/app-shell-auth';

describe('local data clear recovery', () => {
    it('retries a blocked clear after reload and removes the persistent flag', async () => {
        const original = globalThis.BroadcastChannel;
        Object.defineProperty(globalThis, 'BroadcastChannel', { value: undefined, configurable: true });
        localStorage.setItem('times-up.local-data-clear-failed', '1');
        const host = { localDataClearFailed: true, authError: 'blocked' } as AppShellAuthHost;
        try {
            expect(hasPersistentLocalClearFailure()).to.equal(true);
            await recoverLocalDataClear(host);
            expect(host.localDataClearFailed).to.equal(false);
            expect(host.authError).to.equal('');
            expect(hasPersistentLocalClearFailure()).to.equal(false);
        } finally {
            localStorage.removeItem('times-up.local-data-clear-failed');
            Object.defineProperty(globalThis, 'BroadcastChannel', { value: original, configurable: true });
        }
    });
});
