import './test-setup';
import { expect } from '@esm-bundle/chai';
import { flushUsageNow, loadUsageCounts, saveUsageEnabled } from '../src/services/usage';

describe('usage reporting authentication', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
        localStorage.removeItem('times-up.auth.tokens');
        localStorage.removeItem('times-up:usage-enabled');
        localStorage.removeItem('times-up:usage-counts');
    });

    it('sends the bearer token and API version when flushing counters', async () => {
        localStorage.setItem(
            'times-up.auth.tokens',
            JSON.stringify({ access: 'token', refresh: 'refresh', exp: Math.floor(Date.now() / 1000) + 3600 }),
        );
        saveUsageEnabled(true);
        localStorage.setItem(
            'times-up:usage-counts',
            JSON.stringify({ day: new Date().toISOString().slice(0, 10), counts: { tab_opened: 2 } }),
        );
        let sent: RequestInit | undefined;
        globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
            sent = init;
            return new Response('{"ok":true}', {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            });
        };

        await flushUsageNow();

        const headers = sent?.headers as Record<string, string>;
        expect(headers['Authorization']).to.equal('Bearer token');
        expect(headers['X-Api-Version']).to.equal('1');
        expect(loadUsageCounts().counts['tab_opened']).to.equal(undefined);
    });
});
