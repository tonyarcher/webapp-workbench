import { addScrapeSource, previewScrape, type ScrapePreview } from '../../services/api';
import { invalidateLibrary } from '../../query';

/** State and setters the scrape picker needs from the settings panel. */
export interface ScrapeHost {
    scrapeOpen: boolean;
    scrapeBusy: boolean;
    scrapeStatus: string;
    scrapeStatusError: boolean;
    scrapeCandidates: import('../../services/api').ScrapeCandidate[];
    scrapeSelected: string[];
    scrapePreview: ScrapePreview | null;
    scrapeStrategyId: string;
    status: string;
    statusError: boolean;
    shadowRoot: ShadowRoot | null;
    cancelScrape: () => void;
}

function fields(host: ScrapeHost): { url: string; selector: string } {
    const url = host.shadowRoot?.querySelector<HTMLInputElement>('input[data-scrape-url]');
    const selector = host.shadowRoot?.querySelector<HTMLInputElement>('input[data-scrape-selector]');
    return { url: url?.value.trim() ?? '', selector: selector?.value.trim() ?? '' };
}

function fail(host: ScrapeHost, message: string): void {
    host.scrapeStatus = message;
    host.scrapeStatusError = true;
}

function applyStrategy(host: ScrapeHost, id: string): void {
    const strategy = host.scrapePreview?.strategies.find((entry) => entry.id === id);
    host.scrapeCandidates = strategy?.candidates ?? [];
    host.scrapeSelected = host.scrapeCandidates.map((candidate) => candidate.url);
}

/** Fetch a page and show every way its article list can be read. */
export async function previewPage(host: ScrapeHost): Promise<void> {
    const { url, selector } = fields(host);
    if (!url) {
        fail(host, 'Enter the page URL.');
        return;
    }
    host.scrapeBusy = true;
    try {
        const result = await previewScrape(url, selector);
        host.scrapePreview = result;
        const first = result.strategies[0];
        host.scrapeStrategyId = first?.id ?? '';
        applyStrategy(host, host.scrapeStrategyId);
        host.scrapeStatus = first
            ? `${first.candidates.length} stories found with ${first.label}. Try another list below.`
            : 'No article list found.';
        host.scrapeStatusError = false;
    } catch (err) {
        fail(host, err instanceof Error ? err.message : 'Could not preview the page');
    } finally {
        host.scrapeBusy = false;
    }
}

export function chooseStrategy(host: ScrapeHost, id: string): void {
    host.scrapeStrategyId = id;
    applyStrategy(host, id);
}

export function toggleCandidate(host: ScrapeHost, url: string, checked: boolean): void {
    const next = new Set(host.scrapeSelected);
    if (checked) next.add(url);
    else next.delete(url);
    host.scrapeSelected = [...next];
}

/** Follow the page with only the chosen stories from the chosen list shape. */
export async function followPage(host: ScrapeHost): Promise<void> {
    const { url, selector } = fields(host);
    if (!url) {
        fail(host, 'Enter the page URL.');
        return;
    }
    if (host.scrapeSelected.length === 0) {
        fail(host, 'Select at least one story.');
        return;
    }
    host.scrapeBusy = true;
    try {
        const strategy = host.scrapePreview?.strategies.find((entry) => entry.id === host.scrapeStrategyId);
        await addScrapeSource(url, strategy?.selector ?? selector, host.scrapeSelected);
        await invalidateLibrary();
        host.cancelScrape();
        host.status = `Following ${url}.`;
        host.statusError = false;
    } catch (err) {
        fail(host, err instanceof Error ? err.message : 'Could not follow the page');
    } finally {
        host.scrapeBusy = false;
    }
}
