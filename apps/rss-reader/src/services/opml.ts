import { getFeeds, getFolders, putFeed, putFolder, uid } from '../db/db';
import { isFolder, parseOpml } from './parser';
import type { Feed, Folder, OpmlNode } from '../types';

export interface OpmlImportResult {
  folders: Folder[];
  feeds: Feed[];
}

export async function importOpml(xml: string): Promise<OpmlImportResult> {
  const nodes = parseOpml(xml);
  const existingFolders = await getFolders();
  const existingFeeds = await getFeeds();

  const createdFolders: Folder[] = [];
  const createdFeeds: Feed[] = [];

  const ensureFolder = async (title: string): Promise<Folder> => {
    const existing = existingFolders.find(
      (f) => f.title.toLowerCase() === title.toLowerCase(),
    );
    if (existing) return existing;
    const folder: Folder = { id: uid(), title, createdAt: Date.now() };
    await putFolder(folder);
    existingFolders.push(folder);
    createdFolders.push(folder);
    return folder;
  };

  const addFeed = async (
    xmlUrl: string,
    title: string,
    htmlUrl: string | undefined,
    folderId: string | null,
  ): Promise<void> => {
    const existing = existingFeeds.find((f) => f.url.toLowerCase() === xmlUrl.toLowerCase());
    if (existing) {
      if (folderId !== null) {
        existing.folderId = folderId;
        await putFeed(existing);
      }
      return;
    }
    const feed: Feed = {
      id: uid(),
      title: title || xmlUrl,
      url: xmlUrl,
      siteUrl: htmlUrl,
      folderId,
      unread: 0,
      addedAt: Date.now(),
    };
    await putFeed(feed);
    existingFeeds.push(feed);
    createdFeeds.push(feed);
  };

  const walk = async (nodes: OpmlNode[], folderId: string | null) => {
    for (const node of nodes) {
      if (isFolder(node)) {
        const folder = await ensureFolder(node.title);
        await walk(node.children, folder.id);
      } else {
        await addFeed(node.xmlUrl, node.title, node.htmlUrl, folderId);
      }
    }
  };

  await walk(nodes, null);
  return { folders: createdFolders, feeds: createdFeeds };
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function exportOpml(): Promise<string> {
  const folders = await getFolders();
  const feeds = await getFeeds();

  const renderSources = (folderId: string | null): string => {
    return feeds
      .filter((f) => f.folderId === folderId)
      .map(
        (f) =>
          `    <outline type="rss" text="${escapeXml(f.title)}" title="${escapeXml(f.title)}" xmlUrl="${escapeXml(f.url)}"${f.siteUrl ? ` htmlUrl="${escapeXml(f.siteUrl)}"` : ''}/>`,
      )
      .join('\n');
  };

  const folderOutlines = folders
    .map((folder) => {
      const sources = renderSources(folder.id);
      if (!sources) return '';
      return `  <outline text="${escapeXml(folder.title)}" title="${escapeXml(folder.title)}">\n${sources}\n  </outline>`;
    })
    .filter(Boolean);

  const topSources = renderSources(null);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<opml version="2.0">\n  <head><title>Subscriptions</title></head>\n  <body>\n` +
    (folderOutlines.length ? folderOutlines.join('\n') + '\n' : '') +
    topSources +
    `\n  </body>\n</opml>\n`
  );
}
