import type { Feed, Folder, SavedSearch } from '../types';
import { loadMuteRules, type MuteRule } from './mute-rules';

/** D3 portable export: a JSON archive and a line-separated text mirror. */
export const ARCHIVE_VERSION = 1;

export interface LibraryArchive {
    version: number;
    exportedAt: string;
    folders: Array<{ title: string; createdAt: number }>;
    feeds: Array<{ title: string; url: string; siteUrl?: string | undefined; folders: string[] }>;
    savedSearches: Array<{
        title: string;
        query: string;
        scopeKind: string;
        scopeId?: string | undefined;
        alert: boolean;
    }>;
    muteRules: MuteRule[];
}

/** Build a versioned archive from the library the app already holds. */
export function buildArchive(
    folders: Folder[],
    feeds: Feed[],
    savedSearches: SavedSearch[],
    muteRules: MuteRule[] = loadMuteRules(),
    now: Date = new Date(),
): LibraryArchive {
    const titleById = new Map(folders.map((f) => [f.id, f.title]));
    return {
        version: ARCHIVE_VERSION,
        exportedAt: now.toISOString(),
        folders: folders.map((f) => ({ title: f.title, createdAt: f.createdAt })),
        feeds: feeds.map((f) => ({
            title: f.title,
            url: f.url,
            ...(f.siteUrl ? { siteUrl: f.siteUrl } : {}),
            folders: f.folderIds.map((id) => titleById.get(id)).filter((t): t is string => t !== undefined),
        })),
        savedSearches: savedSearches.map((s) => ({
            title: s.title,
            query: s.query,
            scopeKind: s.scopeKind,
            ...(s.scopeId ? { scopeId: s.scopeId } : {}),
            alert: s.alert === true,
        })),
        muteRules,
    };
}

/**
 * Line-separated mirror of the same archive. One record per line, tab
 * separated; fields within a record are escaped. Easy to diff, grep, and edit
 * in a text editor, the way a TikTok text export reads.
 */
export function archiveToText(archive: LibraryArchive): string {
    const lines = [`version\t${archive.version}`, `exportedAt\t${archive.exportedAt}`];
    for (const f of archive.folders) lines.push(`folder\t${cell(f.title)}\t${f.createdAt}`);
    for (const f of archive.feeds) {
        lines.push(
            `feed\t${cell(f.title)}\t${cell(f.url)}\t${cell(f.siteUrl ?? '')}\t${f.folders.map(cell).join('|')}`,
        );
    }
    for (const s of archive.savedSearches) {
        lines.push(
            `search\t${cell(s.title)}\t${cell(s.query)}\t${s.scopeKind}\t${cell(s.scopeId ?? '')}\t${s.alert ? 1 : 0}`,
        );
    }
    for (const r of archive.muteRules) lines.push(`mute\t${cell(r.id)}\t${cell(JSON.stringify(r))}`);
    return `${lines.join('\n')}\n`;
}

function cell(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n')
        .replace(/\|/g, '\\|')
        .replace(/,/g, '\\,');
}

/** Read the text mirror back. Unknown lines and future versions are ignored. */
export function textToArchive(text: string): LibraryArchive | null {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
    const get = (key: string): string[] | null => {
        const line = lines.find((l) => l.startsWith(`${key}\t`));
        return line ? line.slice(key.length + 1).split('\t') : null;
    };
    const version = Number(get('version')?.[0] ?? 0);
    if (version !== ARCHIVE_VERSION) return null;
    const folders: LibraryArchive['folders'] = [];
    const feeds: LibraryArchive['feeds'] = [];
    const savedSearches: LibraryArchive['savedSearches'] = [];
    const muteRules: MuteRule[] = [];
    for (const line of lines) {
        const [kind, ...fields] = line.split('\t');
        if (kind === 'folder') folders.push({ title: uncell(fields[0] ?? ''), createdAt: Number(fields[1] ?? 0) });
        if (kind === 'feed') {
            feeds.push({
                title: uncell(fields[0] ?? ''),
                url: uncell(fields[1] ?? ''),
                siteUrl: uncell(fields[2] ?? '') || undefined,
                folders: (fields[3] ?? '').split('|').filter(Boolean).map(uncell),
            });
        }
        if (kind === 'search') {
            savedSearches.push({
                title: uncell(fields[0] ?? ''),
                query: uncell(fields[1] ?? ''),
                scopeKind: fields[2] ?? 'all',
                scopeId: uncell(fields[3] ?? '') || undefined,
                alert: fields[4] === '1',
            });
        }
        if (kind === 'mute') {
            try {
                const rule = JSON.parse(uncell(fields[1] ?? '')) as MuteRule;
                if (rule && typeof rule.id === 'string') muteRules.push(rule);
            } catch {
                // A damaged line is skipped; the rest of the archive still loads.
            }
        }
    }
    return {
        version,
        exportedAt: get('exportedAt')?.[0] ?? new Date().toISOString(),
        folders,
        feeds,
        savedSearches,
        muteRules,
    };
}

function uncell(value: string): string {
    return value
        .replace(/\\t/g, '\t')
        .replace(/\\n/g, '\n')
        .replace(/\\\|/g, '|')
        .replace(/\\,/g, ',')
        .replace(/\\\\/g, '\\');
}
