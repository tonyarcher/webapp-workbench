export interface Folder {
    id: string;
    title: string;
    createdAt: number;
    sortOrder?: number | undefined;
}

export interface Feed {
    id: string;
    title: string;
    url: string;
    siteUrl?: string | undefined;
    icon?: string | undefined;
    folderIds: string[];
    unread: number;
    addedAt: number;
    lastFetchedAt?: number | undefined;
    lastError?: string | undefined;
}

export interface Article {
    id: string;
    feedId: string;
    guid: string;
    title: string;
    link?: string | undefined;
    author?: string | undefined;
    summary?: string | undefined;
    content?: string | undefined;
    published: number;
    fetchedAt: number;
    read: 0 | 1;
    starred: boolean;
    normLink?: string | undefined;
    comments?: number | undefined;
    popularity: number;
    engagement?: number | undefined;
    hot: number;
}

export type ArticleSort = 'hot' | 'newest' | 'oldest';
export type ListViewType = 'detailed' | 'headline' | 'cards';
export type FeedSort = 'alpha' | 'unread';

export type View =
    | { kind: 'all' }
    | { kind: 'folder'; id: string }
    | { kind: 'feed'; id: string }
    | { kind: 'brief' }
    | { kind: 'today' };

export interface ParsedItem {
    guid: string;
    title: string;
    link?: string | undefined;
    author?: string | undefined;
    summary?: string | undefined;
    content?: string | undefined;
    media?: string | undefined;
    comments?: number | undefined;
    published: number;
}

export interface ParsedFeed {
    title: string;
    siteUrl?: string | undefined;
    items: ParsedItem[];
}

export interface OpmlSource {
    title: string;
    xmlUrl: string;
    htmlUrl?: string | undefined;
}

export type OpmlNode = OpmlSource | OpmlFolder;

export interface OpmlFolder {
    title: string;
    children: OpmlNode[];
}
