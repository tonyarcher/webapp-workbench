import { addFeed, discoverFeeds, type DiscoveredFeed } from '../../services/api';
import { invalidateLibrary } from '../../query';

/** State and setters the discovery handlers need from the settings panel. */
export interface DiscoveryHost {
    discoverBusy: boolean;
    discoverStatus: string;
    discoverStatusError: boolean;
    discovered: DiscoveredFeed[];
    status: string;
    statusError: boolean;
    shadowRoot: ShadowRoot | null;
    cancelDiscover: () => void;
}

function siteUrl(host: DiscoveryHost): string {
    return host.shadowRoot?.querySelector<HTMLInputElement>('input[data-discover-url]')?.value.trim() ?? '';
}

function fail(host: DiscoveryHost, message: string): void {
    host.discoverStatus = message;
    host.discoverStatusError = true;
}

/** Paste a site address, find its feeds, and show a preview of the top three. */
export async function discoverSite(host: DiscoveryHost): Promise<void> {
    const url = siteUrl(host);
    if (!url) {
        fail(host, 'Enter the site address.');
        return;
    }
    host.discoverBusy = true;
    try {
        const result = await discoverFeeds(url);
        host.discovered = result.feeds;
        host.discoverStatus = result.feeds.length
            ? `${result.feeds.length} feeds found on ${result.siteTitle ?? url}.`
            : 'No feeds found on this site.';
        host.discoverStatusError = false;
    } catch (err) {
        host.discovered = [];
        fail(host, err instanceof Error ? err.message : 'Could not find feeds');
    } finally {
        host.discoverBusy = false;
    }
}

/** Subscribe to one discovered feed and close the finder. */
export async function subscribeToFeed(host: DiscoveryHost, feed: DiscoveredFeed): Promise<void> {
    host.discoverBusy = true;
    try {
        await addFeed(feed.url);
        await invalidateLibrary();
        host.status = `Following ${feed.title}.`;
        host.statusError = false;
        host.cancelDiscover();
    } catch (err) {
        fail(host, err instanceof Error ? err.message : 'Could not follow that feed');
    } finally {
        host.discoverBusy = false;
    }
}
