import {
    addFeed,
    createSavedSearch,
    exportOpmlFile,
    importOpmlFile,
    setFeedFolderMembership,
    setSavedSearchAlert,
    syncAllFeeds,
} from '../../mutations';
import { addFolder, migrateLibrary } from '../../services/api';
import { normalizeMastodonHost, type ShareTarget } from '../../services/share';
import { fetchLibrary, invalidateArticles, invalidateLibrary } from '../../query';
import { navigate } from '../../router';
import { ALL_SHARE_TARGETS, loadShareTargets, saveMastodonHost, saveShareTargets } from '../../services/share-settings';
import { buildMigratePayload, readIdbForMigration } from '../../services/migrate-export';
import { archiveToText, buildArchive, parseArchive } from '../../services/portable-export';
import { importArchive, isArchiveFile } from '../../services/archive-import';
import { saveMuteRules } from '../../services/mute-rules';

export type ExportFormat = 'json' | 'text' | 'opml';

const MIGRATE_SIZE_LIMIT = 1_800_000;

/** State the feed and sharing handlers need from the settings panel. */
export interface FeedsHost {
    adding: boolean;
    busy: boolean;
    migrating: boolean;
    status: string;
    statusError: boolean;
    shareStatus: string;
    shareStatusError: boolean;
    shareTargets: ShareTarget[];
    mastodonHost: string;
    shadowRoot: ShadowRoot | null;
    updateComplete: Promise<boolean>;
    clearMastodonDraft: () => void;
}

export function toggleShare(host: FeedsHost, target: ShareTarget, checked: boolean): void {
    const current = new Set(loadShareTargets());
    if (checked) current.add(target);
    else current.delete(target);
    const next = ALL_SHARE_TARGETS.filter((item) => current.has(item));
    saveShareTargets(next);
    host.shareTargets = next;
    window.dispatchEvent(new CustomEvent('share-settings-changed'));
}

export async function submitMastodon(host: FeedsHost): Promise<void> {
    const input = host.shadowRoot?.querySelector<HTMLInputElement>('#mastodon-host');
    const clean = normalizeMastodonHost(input?.value.trim() ?? '');
    if (!clean) {
        host.shareStatus = 'Enter an instance domain, e.g. mastodon.social.';
        host.shareStatusError = true;
        return;
    }
    saveMastodonHost(clean);
    if (input) input.value = clean;
    host.mastodonHost = clean;
    host.clearMastodonDraft();
    host.shareStatus = `Sharing through ${clean}.`;
    host.shareStatusError = false;
    window.dispatchEvent(new CustomEvent('share-settings-changed'));
}

export function cancelAdd(host: FeedsHost): void {
    host.adding = false;
}

export function openAdd(host: FeedsHost): void {
    host.adding = true;
    host.status = '';
    host.statusError = false;
    void host.updateComplete.then(() => {
        host.shadowRoot?.querySelector<HTMLInputElement>('input[data-add-url]')?.focus();
    });
}

export function openImport(host: FeedsHost): void {
    host.shadowRoot?.querySelector<HTMLInputElement>('input[data-import]')?.click();
}

export function openMuteFilters(): void {
    navigate({ kind: 'settings', section: 'mute-filters' });
}

export async function submitAdd(host: FeedsHost): Promise<void> {
    const input = host.shadowRoot?.querySelector<HTMLInputElement>('input[data-add-url]');
    const url = input?.value.trim() ?? '';
    if (!url) return;
    host.busy = true;
    try {
        const feed = await addFeed(url);
        if (input) input.value = '';
        host.adding = false;
        navigate({ kind: 'feed', id: feed.id });
    } catch (err) {
        host.status = err instanceof Error ? err.message : 'Could not add feed';
        host.statusError = true;
    } finally {
        host.busy = false;
    }
}

export async function importFile(host: FeedsHost, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    host.busy = true;
    host.status = '';
    host.statusError = false;
    try {
        const text = await file.text();
        const archiveFile = isArchiveFile(file.name);
        const archive = archiveFile ? parseArchive(text) : null;
        if (archiveFile && !archive) throw new Error('Invalid Times Up archive or unsupported version.');
        if (archive) {
            const result = await importArchive(archive, {
                addFolder,
                addFeed,
                setFeedFolders: setFeedFolderMembership,
                createSavedSearch,
                setSavedSearchAlert,
                saveMuteRules,
            });
            const skipped = result.skipped > 0 ? `, ${result.skipped} skipped` : '';
            host.status = `Imported ${result.folders} folders, ${result.feeds} feeds, ${result.searches} searches, ${result.rules} mute rules${skipped}. Syncing articles.`;
            await syncAllFeeds((done: number, total: number) => {
                host.status = `Syncing ${done + 1}/${total}.`;
            });
            host.status = 'Import complete';
            return;
        }
        const result = await importOpmlFile(text);
        const skipped = result.skippedFeeds > 0 ? ` (${result.skippedFeeds} skipped)` : '';
        host.status = `Imported ${result.subscribedFeeds} new subscriptions${skipped}. Syncing articles.`;
        await syncAllFeeds((done: number, total: number) => {
            host.status = `Syncing ${done + 1}/${total}.`;
        });
        host.status = 'Import complete';
    } catch (err) {
        host.status = err instanceof Error ? `Import failed: ${err.message}` : 'Import failed';
        host.statusError = true;
    } finally {
        host.busy = false;
        input.value = '';
    }
}

export async function exportFile(host: FeedsHost, format: ExportFormat = 'opml'): Promise<void> {
    host.busy = true;
    try {
        let body: string;
        let mime: string;
        let name: string;
        if (format === 'opml') {
            body = await exportOpmlFile();
            mime = 'text/xml';
            name = 'subscriptions.opml';
        } else {
            const lib = await fetchLibrary();
            const archive = buildArchive(lib.folders, lib.feeds, lib.savedSearches);
            body = format === 'json' ? JSON.stringify(archive, null, 2) : archiveToText(archive);
            mime = format === 'json' ? 'application/json' : 'text/plain';
            name = format === 'json' ? 'times-up-archive.json' : 'times-up-archive.txt';
        }
        const blob = new Blob([body], { type: mime });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        URL.revokeObjectURL(url);
        host.status = `Exported ${name}`;
        host.statusError = false;
    } catch (err) {
        host.status = err instanceof Error ? `Export failed: ${err.message}` : 'Export failed';
        host.statusError = true;
    } finally {
        host.busy = false;
    }
}

async function migrate(host: FeedsHost): Promise<void> {
    const { folders, feeds, articles, metaEntries } = await readIdbForMigration();
    if (!feeds.length && !folders.length) {
        host.status = 'No local data to migrate.';
        return;
    }
    const payload = buildMigratePayload(folders, feeds, articles, metaEntries);
    const json = JSON.stringify(payload);
    if (json.length > MIGRATE_SIZE_LIMIT)
        throw new Error(`Payload too large (${Math.round(json.length / 1024)} KB). Use OPML import instead.`);
    const result = await migrateLibrary(payload);
    host.status = `Migrated ${result.feedsAdded} feeds, ${result.foldersAdded} folders, ${result.statesQueued} states. Syncing.`;
    host.statusError = false;
    await invalidateLibrary();
    await invalidateArticles();
    await syncAllFeeds();
    host.status = 'Migration complete';
}

export async function migrateLibraryData(host: FeedsHost): Promise<void> {
    host.migrating = true;
    host.status = '';
    host.statusError = false;
    try {
        await migrate(host);
    } catch (err) {
        host.status = err instanceof Error ? `Migration failed: ${err.message}` : 'Migration failed';
        host.statusError = true;
    } finally {
        host.migrating = false;
    }
}
