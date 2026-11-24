import { addFeed, discoverFeeds, previewScrape, addScrapeSource, type DiscoveredFeed } from '../../services/api';
import { exportOpmlFile, importOpmlFile, syncAllFeeds } from '../../mutations';
import { el } from './organize-view-dom';

/** Feed management controls that live under Organize, not General. */
export interface FeedToolsHost {
    status(text: string, error?: boolean): void;
    reload(): Promise<void>;
}

const discovered: DiscoveredFeed[] = [];
let discoverStatus = '';
let scrapeUrl = '';
let scrapeStatus = '';
let strategyCount = 0;

export function clearFeedTools(): void {
    discovered.length = 0;
    discoverStatus = '';
    scrapeStatus = '';
    scrapeUrl = '';
    strategyCount = 0;
}

export function renderFeedTools(host: FeedToolsHost): HTMLElement {
    const section = el('section', 'feed-tools');
    section.append(el('h3', undefined, 'Feed management'));
    section.append(el('p', 'intro', 'Add, discover, import and export feeds. Feed health is a separate tab.'));

    const add = el('form', 'feed-form');
    const url = el('input', 'add-url');
    url.type = 'url';
    url.placeholder = 'https://example.com/feed';
    url.setAttribute('data-add-url', '');
    url.setAttribute('aria-label', 'Feed URL');
    const addBtn = el('button', 'btn primary', 'Subscribe');
    addBtn.type = 'submit';
    addBtn.setAttribute('aria-label', 'Add feed URL');
    add.append(url, addBtn);
    add.addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = url.value.trim();
        if (!value) return;
        try {
            await addFeed(value);
            url.value = '';
            host.status('Feed added. Syncing.');
            await syncAllFeeds();
            await host.reload();
        } catch (err) {
            host.status(err instanceof Error ? err.message : 'Could not add the feed', true);
        }
    });
    section.append(add);

    const discover = el('form', 'feed-form');
    const site = el('input');
    site.type = 'url';
    site.placeholder = 'https://example.com';
    site.setAttribute('data-discover-url', '');
    site.setAttribute('aria-label', 'Site address');
    const find = el('button', 'btn', 'Find feeds');
    find.type = 'submit';
    discover.append(site, find);
    discover.addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = site.value.trim();
        if (!value) return;
        discovered.length = 0;
        try {
            const result = await discoverFeeds(value);
            discovered.push(...result.feeds);
            discoverStatus = `${result.feeds.length} feeds found on ${result.siteTitle ?? value}.`;
        } catch (err) {
            discoverStatus = err instanceof Error ? err.message : 'No feeds found';
        }
        await host.reload();
    });
    section.append(discover);
    if (discoverStatus) section.append(el('p', 'status', discoverStatus));
    for (const feed of discovered) {
        const row = el('div', 'discovered');
        row.append(el('span', undefined, feed.title), el('span', 'meta', `rss | ${feed.source}`));
        if (feed.recentTitles.length) {
            row.append(el('div', 'recent-titles', feed.recentTitles.join(' · ')));
        }
        const sub = el('button', 'btn', 'Subscribe');
        sub.addEventListener('click', async () => {
            try {
                await addFeed(feed.url);
                discovered.length = 0;
                discoverStatus = '';
                host.status(`Subscribed to ${feed.title}.`);
                await syncAllFeeds();
                await host.reload();
            } catch (err) {
                host.status(err instanceof Error ? err.message : 'Could not subscribe', true);
            }
        });
        row.append(sub);
        section.append(row);
    }

    const scrape = el('form', 'feed-form');
    const page = el('input');
    page.type = 'url';
    page.value = scrapeUrl;
    page.placeholder = 'https://example.com/blog';
    page.setAttribute('data-scrape-url', '');
    page.setAttribute('aria-label', 'Page URL');
    const preview = el('button', 'btn', 'Preview');
    preview.type = 'submit';
    scrape.append(page, preview);
    scrape.addEventListener('submit', async (e) => {
        e.preventDefault();
        scrapeUrl = page.value.trim();
        if (!scrapeUrl) return;
        try {
            strategyCount = (await previewScrape(scrapeUrl)).strategies.length;
            scrapeStatus = '';
        } catch (err) {
            strategyCount = 0;
            scrapeStatus = err instanceof Error ? err.message : 'Preview failed';
        }
        await host.reload();
    });
    section.append(scrape);
    if (scrapeStatus) section.append(el('p', 'status', scrapeStatus));
    if (strategyCount) {
        section.append(el('p', undefined, `${strategyCount} strategies found.`));
        const follow = el('button', 'btn primary', 'Follow page');
        follow.addEventListener('click', async () => {
            try {
                await addScrapeSource(scrapeUrl);
                strategyCount = 0;
                scrapeUrl = '';
                host.status('Page followed. Syncing.');
                await syncAllFeeds();
                await host.reload();
            } catch (err) {
                host.status(err instanceof Error ? err.message : 'Could not follow the page', true);
            }
        });
        section.append(follow);
    }

    const tools = el('div', 'feed-tools-actions');
    const importBtn = el('button', 'btn', 'Import OPML');
    const file = el('input');
    file.type = 'file';
    file.accept = '.opml,.xml,text/xml';
    file.hidden = true;
    file.addEventListener('change', async () => {
        const chosen = file.files?.[0];
        if (!chosen) return;
        try {
            await importOpmlFile(await chosen.text());
            host.status('Imported subscriptions. Syncing.');
            await syncAllFeeds();
            await host.reload();
        } catch (err) {
            host.status(err instanceof Error ? err.message : 'Import failed', true);
        }
        file.value = '';
    });
    importBtn.addEventListener('click', () => file.click());
    const exportBtn = el('button', 'btn', 'Export OPML');
    exportBtn.addEventListener('click', async () => {
        try {
            const xml = await exportOpmlFile();
            const blob = new Blob([xml], { type: 'text/xml' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'subscriptions.opml';
            anchor.click();
            URL.revokeObjectURL(url);
            host.status('Exported subscriptions.opml');
        } catch {
            host.status('Export failed', true);
        }
    });
    tools.append(importBtn, exportBtn, file);
    section.append(tools);
    return section;
}
