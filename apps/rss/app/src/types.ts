export interface Folder {
    id: string;
    title: string;
    createdAt: number;
    sortOrder?: number | undefined;
}

export interface SavedSearch {
    id: string;
    title: string;
    query: string;
    scopeKind: SearchScopeKind;
    scopeId?: string | undefined;
    sortOrder?: number | undefined;
    createdAt: number;
    unread: number;
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
    scores?:
        | {
              worthy: number;
              interest: number;
              topic?: string | undefined;
              popularityOutlook: number;
              readability: number;
              scoredAt?: number | undefined;
              model?: string | undefined;
          }
        | undefined;
}

export type ArticleSort = 'hot' | 'newest' | 'oldest';
export type ListViewType = 'detailed' | 'headline' | 'cards';
export type FeedSort = 'alpha' | 'unread';

export type SearchScopeKind = 'all' | 'folder' | 'feed';

export type View =
    | { kind: 'all' }
    | { kind: 'folder'; id: string }
    | { kind: 'interesting'; id: string }
    | { kind: 'feed'; id: string }
    | { kind: 'brief' }
    | { kind: 'today' }
    | { kind: 'frontpage' }
    | { kind: 'organize' }
    | { kind: 'mute-filters' }
    | {
          kind: 'search';
          scope?: SearchScopeKind | undefined;
          id?: string | undefined;
          q?: string | undefined;
          savedId?: string | undefined;
      };

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
    icon?: string | undefined;
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

export interface EditionSection {
    id: string;
    topic?: string | undefined;
    title: string;
    summary?: string | undefined;
    opinion?: string | undefined;
    articleIds: string[];
    scores?:
        { worthy: number; interest: number; newness?: number | undefined; popularity?: number | undefined } | undefined;
    verified?: boolean | undefined;
}

export type EditionStatus = 'ready' | 'building' | 'failed';

export interface Edition {
    id: string;
    generatedAt: number;
    windowHours: number;
    status: EditionStatus;
    model?: string | undefined;
    opinion?: string | undefined;
    sections: EditionSection[];
}

export interface EditionMeta {
    id: string;
    generatedAt: number;
    windowHours: number;
    status: EditionStatus;
}
