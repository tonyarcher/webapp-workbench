export interface Folder {
    id: string;
    title: string;
    createdAt: number;
    sortOrder?: number;
}

export interface Feed {
    id: string;
    title: string;
    url: string;
    siteUrl?: string;
    icon?: string;
    folderIds: string[];
    unread: number;
    addedAt: number;
    lastFetchedAt?: number;
    lastError?: string;
}

export interface Article {
    id: string;
    feedId: string;
    guid: string;
    title: string;
    link?: string;
    author?: string;
    summary?: string;
    content?: string;
    published: number;
    fetchedAt: number;
    read: 0 | 1;
    starred: boolean;
    normLink?: string;
    comments?: number;
    popularity: number;
    engagement?: number;
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
    link?: string;
    author?: string;
    summary?: string;
    content?: string;
    media?: string;
    comments?: number;
    published: number;
}

export interface ParsedFeed {
    title: string;
    siteUrl?: string;
    items: ParsedItem[];
}

export interface OpmlSource {
    title: string;
    xmlUrl: string;
    htmlUrl?: string;
}

export type OpmlNode = OpmlSource | OpmlFolder;

export interface OpmlFolder {
    title: string;
    children: OpmlNode[];
}
