import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {toScrollItem} from '../../services/scroll-item'
import {
    communityPostsInfiniteQuery,
    hydrateCommunityPosts,
    hydratePosts,
    InfiniteQueryController,
    postsInfiniteQuery,
} from '../../query'
import type {NsfwFilter, PostFeedType, PostPage, PostSort, Software} from '../../types'
import type {ScrollItem} from 'vertical-scroll-core'
import 'vertical-scroll-core'
import styles from './scroll-feed.css?inline'

@customElement('lvs-scroll-feed')
export class ScrollFeed extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) instance = ''
    @property({attribute: false}) feedType: PostFeedType = 'All'
    @property({attribute: false}) sort: PostSort = 'Hot'
    @property({attribute: false}) software: Software = 'lemmy'
    @property({attribute: false}) nsfwFilter: NsfwFilter = 'Include'
    /** Bearer jwt when logged in; '' when anonymous. */
    @property({attribute: false}) auth = ''
    /** When set, scrolls this community's posts instead of the main feed. */
    @property({attribute: false}) communityId: number | null = null

    @state() private resetKey = ''
    @state() private _items: ScrollItem[] = []

    private readonly query = new InfiniteQueryController<PostPage>(this, () =>
        this.communityId === null
            ? postsInfiniteQuery(this.instance, this.feedType, this.sort, this.software, this.nsfwFilter, this.auth)
            : communityPostsInfiniteQuery(this.instance, this.communityId, this.sort, this.software, this.nsfwFilter, this.auth),
    )

    private prevParams = ''
    private lastData: unknown = null

    override connectedCallback(): void {
        super.connectedCallback()
        const hydrate = this.communityId === null
            ? hydratePosts(this.instance, this.feedType, this.sort, this.nsfwFilter, this.software, this.auth)
            : hydrateCommunityPosts(this.instance, this.communityId, this.sort, this.nsfwFilter, this.software, this.auth)
        void hydrate.catch(() => {})
    }

    override willUpdate(_changed: Map<string, unknown>): void {
        const params = JSON.stringify([
            this.instance,
            this.feedType,
            this.sort,
            this.nsfwFilter,
            this.software,
            this.communityId,
            this.auth,
        ])
        if (this.prevParams !== '' && params !== this.prevParams) {
            this.resetKey = params
        }
        this.prevParams = params

        // Rebuild items only when query data actually changes (not on every render)
        const data = this.query.value.data
        if (data && data !== this.lastData) {
            this.lastData = data
            this._items = data.pages.flatMap((page) => page.posts.map(toScrollItem))
        }
    }

    private get loading(): boolean {
        return this.query.value.status === 'pending'
    }

    private get error(): string | null {
        const {status, error} = this.query.value
        if (status === 'error') return error instanceof Error ? error.message : String(error)
        return null
    }

    private onNearEnd(): void {
        if (this.query.hasNextPage && !this.query.isFetchingNextPage) this.query.fetchNextPage()
    }

    private onRetry(): void {
        this.query.refetch()
    }

    override render(): TemplateResult {
        return html`<vsc-scroll-viewport
            .items=${this._items}
            .loading=${this.loading}
            .error=${this.error}
            .resetKey=${this.resetKey}
            @near-end=${this.onNearEnd}
            @retry=${this.onRetry}
        ></vsc-scroll-viewport>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-scroll-feed': ScrollFeed
    }
}
