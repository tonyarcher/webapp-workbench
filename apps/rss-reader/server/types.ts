// ---- local type definitions (mirrors src/types.ts without importing it) ----

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

// ---- DB row shapes ----

export interface UserRow {
    id: string;
    label: string;
    created_at: Date;
}

export interface FolderRow {
    id: string;
    user_id: string;
    title: string;
    sort_order: number;
    created_at: Date;
}

export interface FeedRow {
    id: string;
    user_id: string;
    xml_url: string;
    site_url: string | null;
    title: string;
    added_at: Date;
}

export interface ArticleRow {
    id: string;
    feed_id: string;
    guid: string;
    title: string;
    link: string | null;
    norm_link: string | null;
    domain: string | null;
    author: string | null;
    summary: string | null;
    content_html: string | null;
    comments: number | null;
    published_at: Date;
    fetched_at: Date;
    popularity: number;
    engagement: number;
    hot: number;
}

export interface ArticleStateRow {
    user_id: string;
    article_id: string;
    read: boolean;
    read_at: Date | null;
    starred: boolean;
}

export interface FeedSyncRow {
    feed_id: string;
    etag: string | null;
    last_modified: string | null;
    last_fetched_at: Date | null;
    last_error: string | null;
}

export interface PendingStateRow {
    id: number;
    user_id: string;
    feed_id: string;
    guid: string | null;
    norm_link: string | null;
    link: string | null;
    read: boolean;
    read_at: Date | null;
    starred: boolean;
    created_at: Date;
}

export interface UserAffinityRow {
    user_id: string;
    key: string;
    value: number;
    updated_at: Date;
}

// ---- API JSON shapes (match client types.ts exactly) ----

export interface ApiFolder {
    id: string;
    title: string;
    createdAt: number;
    sortOrder?: number;
}

export interface ApiFeed {
    id: string;
    title: string;
    url: string;
    siteUrl?: string;
    folderIds: string[];
    unread: number;
    addedAt: number;
    lastFetchedAt?: number;
    lastError?: string;
}

export interface ApiArticle {
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
    image?: string;
}
