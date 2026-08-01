// ---- api enums ----

export type FeedType = 'All' | 'Local'
export type ViewMode = 'list' | 'scroll'
export type NsfwFilter = 'Include' | 'Exclude' | 'Only'
export const NSFW_FILTERS: NsfwFilter[] = ['Include', 'Exclude', 'Only']
export type PostSort =
    | 'Active'
    | 'Hot'
    | 'New'
    | 'Old'
    | 'MostComments'
    | 'NewComments'
    | 'TopHour'
    | 'TopSixHour'
    | 'TopTwelveHour'
    | 'TopDay'
    | 'TopWeek'
    | 'TopMonth'
    | 'TopThreeMonths'
    | 'TopSixMonths'
    | 'TopNineMonths'
    | 'TopYear'
    | 'TopAll'
    | 'Controversial'
    | 'Scaled'
export type CommunitySort =
    | 'Active'
    | 'Hot'
    | 'New'
    | 'Old'
    | 'MostComments'
    | 'NewComments'
    | 'TopHour'
    | 'TopSixHour'
    | 'TopTwelveHour'
    | 'TopDay'
    | 'TopWeek'
    | 'TopMonth'
    | 'TopThreeMonths'
    | 'TopSixMonths'
    | 'TopNineMonths'
    | 'TopYear'
    | 'TopAll'
    | 'Controversial'
    | 'Scaled'

// ---- adapted domain models (subset of Lemmy's API shapes we actually render) ----

export interface LemmyCommunity {
    id: number
    name: string
    title: string
    actorId: string
    local: boolean
    icon: string | null
    banner: string | null
    description: string | null
    published: string
    subscribers: number
    posts: number
    comments: number
    subscribed: boolean
    blocked: boolean
}

export type PostContentType = 'Image' | 'Video' | 'Link' | 'Discussion'

export interface LemmyPost {
    id: number
    name: string
    url: string | null
    body: string | null
    thumbnailUrl: string | null
    nsfw: boolean
    pinnedLocal: boolean
    pinnedCommunity: boolean
    published: string
    communityId: number
    communityName: string
    communityActorId: string
    communityTitle: string
    communityIcon: string | null
    creatorActorId: string
    creatorName: string
    creatorDisplayName: string | null
    creatorAvatar: string | null
    score: number
    upvotes: number
    downvotes: number
    comments: number
    myVote: number | null
    /** Canonical link on the source instance (ap_id), used to open the original post. */
    postUrl: string
    /** Detected content kind, drives the scroll view rendering. */
    postType: PostContentType | null
    /** Image(s) for the scroll view; more than one renders a carousel. */
    imageUrls: string[]
    videoUrl: string | null
    linkUrl: string | null
}

export interface LemmySite {
    name: string
    actorId: string
    version: string
    icon: string | null
    description: string | null
}

/** Which fediverse software an instance runs, determined by probing its API. */
export type Software = 'lemmy' | 'piefed' | 'unknown'

export interface SiteResult {
    site: LemmySite
    software: Software
}

// ---- api responses ----

export interface PostPage {
    posts: LemmyPost[]
    page: number
}

export interface CommunityPage {
    communities: LemmyCommunity[]
    page: number
}

// ---- app settings ----

export interface Settings {
    instance: string
    feedType: FeedType
    postSort: PostSort
    communitySort: CommunitySort
    nsfwFilter: NsfwFilter
    viewMode: ViewMode
}

// ---- routing ----

export type View =
    | {kind: 'feed'}
    | {kind: 'communities'}
    | {kind: 'community'; communityId: number}
    | {kind: 'settings'}

// ---- persistence ----

export interface PostsCacheEntry {
    key: string
    posts: LemmyPost[]
    fetchedAt: number
}

export interface CommunitiesCacheEntry {
    key: string
    communities: LemmyCommunity[]
    fetchedAt: number
}

// ---- misc ----

export const POST_SORTS: PostSort[] = [
    'Active',
    'Hot',
    'New',
    'Old',
    'MostComments',
    'NewComments',
    'TopHour',
    'TopSixHour',
    'TopTwelveHour',
    'TopDay',
    'TopWeek',
    'TopMonth',
    'TopThreeMonths',
    'TopSixMonths',
    'TopNineMonths',
    'TopYear',
    'TopAll',
    'Controversial',
    'Scaled',
]

export const COMMUNITY_SORTS: CommunitySort[] = POST_SORTS

/** PieFed supports a subset of the Lemmy post sorts. */
export const PIEFED_POST_SORTS: PostSort[] = [
    'Active',
    'Hot',
    'New',
    'Old',
    'TopHour',
    'TopSixHour',
    'TopTwelveHour',
    'TopDay',
    'TopWeek',
    'TopMonth',
    'TopThreeMonths',
    'TopSixMonths',
    'TopNineMonths',
    'TopYear',
    'TopAll',
    'Scaled',
]

/** PieFed supports a much smaller community sort set. */
export const PIEFED_COMMUNITY_SORTS: CommunitySort[] = ['Active', 'Hot', 'New', 'Old', 'TopAll']

export function postSortsFor(software: Software): PostSort[] {
    return software === 'piefed' ? PIEFED_POST_SORTS : POST_SORTS
}

export function communitySortsFor(software: Software): CommunitySort[] {
    return software === 'piefed' ? PIEFED_COMMUNITY_SORTS : COMMUNITY_SORTS
}

export const DEFAULT_SETTINGS: Settings = {
    instance: 'lemmy.ml',
    feedType: 'All',
    postSort: 'Hot',
    communitySort: 'Hot',
    nsfwFilter: 'Include',
    viewMode: 'list',
}

export const PAGE_SIZE = 20
export const CACHE_TTL_MS = 10 * 60_000
