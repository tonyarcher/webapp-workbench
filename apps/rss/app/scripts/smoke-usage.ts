import { assert } from './smoke-assert';
import {
    loadUsageCounts,
    loadUsageEnabled,
    recordUsage,
    saveUsageEnabled,
    USAGE_FEATURES,
    usageFeatureLabel,
} from '../src/services/usage';

const mem = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g['localStorage'] = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
};

mem.delete('rss-reader:usage-enabled');
mem.delete('rss-reader:usage-counts');

assert(loadUsageEnabled() === false, 'usage defaults off');
saveUsageEnabled(true);
assert(loadUsageEnabled() === true, 'usage enabled round trip');

recordUsage('tab_opened');
recordUsage('tab_opened');
recordUsage('body_loaded');
const counts = loadUsageCounts();
assert(counts.counts['tab_opened'] === 2, 'usage counts increment per feature');
assert(counts.counts['body_loaded'] === 1, 'usage counts track different features');

saveUsageEnabled(false);
recordUsage('tab_opened');
assert(loadUsageCounts().counts['tab_opened'] === 2, 'usage does not record when disabled');

assert(USAGE_FEATURES.includes('older_article_opened'), 'usage feature enum includes older_article_opened');
assert(usageFeatureLabel('settings_panel_viewed').length > 0, 'usage labels are human readable');

mem.set('rss-reader:usage-counts', JSON.stringify({ day: '2000-01-01', counts: { tab_opened: 9 } }));
assert(loadUsageCounts().counts['tab_opened'] === undefined, 'stale day counts reset');
