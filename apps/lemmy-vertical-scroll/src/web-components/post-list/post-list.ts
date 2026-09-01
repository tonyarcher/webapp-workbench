import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property} from 'lit/decorators.js'
import {ref} from 'lit/directives/ref.js'
import {
    communityPostsInfiniteQuery,
    hydrateCommunityPosts,
    hydratePosts,
    InfiniteQueryController,
    postsInfiniteQuery,
} from '../../query'
import {navigate} from '../../router'
import type {LemmyPost, NsfwFilter, PostFeedType, PostPage, PostSort, Software} from '../../types'
import {VirtualizerController} from '../virtual-list'
import '../post-card/post-card'
import styles from './post-list.css?inline'

@customElement('lvs-post-list')
export class PostList extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) instance = ''
    @property({attribute: false}) feedType: PostFeedType = 'All'
    @property({attribute: false}) sort: PostSort = 'Hot'
    @property({attribute: false}) software: Software = 'lemmy'
    @property({attribute: false}) nsfwFilter: NsfwFilter = 'Include'
    /** Bearer jwt when logged in; '' when anonymous. */
    @property({attribute: false}) auth = ''
    /** When set, lists this community's posts instead of the main feed. */
    @property({attribute: false}) communityId: number | null = null

    private readonly query = new InfiniteQueryController<PostPage>(this, () =>
        this.communityId === null
            ? postsInfiniteQuery(this.instance, this.feedType, this.sort, this.software, this.nsfwFilter, this.auth)
            : communityPostsInfiniteQuery(this.instance, this.communityId, this.sort, this.software, this.nsfwFilter, this.auth),
    )
    private readonly virtualizer = new VirtualizerController<LemmyPost>(
        this,
        () => this.listEl,
        () => this.posts,
        () => this.onNearEnd(),
    )
    private listEl: HTMLElement | null = null
    private prevParams = ''

    override connectedCallback(): void {
        super.connectedCallback()
        const hydrate = this.communityId === null
            ? hydratePosts(this.instance, this.feedType, this.sort, this.nsfwFilter, this.software, this.auth)
            : hydrateCommunityPosts(this.instance, this.communityId, this.sort, this.nsfwFilter, this.software, this.auth)
        void hydrate
    }

    /** Reset to the top when the feed source or parameters change. */
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
            if (this.listEl) this.listEl.scrollTop = 0
        }
        this.prevParams = params
    }

    private get posts(): LemmyPost[] {
        const data = this.query.value.data
        return data ? data.pages.flatMap((page) => page.posts) : []
    }

    private onNearEnd(): void {
        if (this.query.hasNextPage && !this.query.isFetchingNextPage) this.query.fetchNextPage()
    }

    private renderPaused(): TemplateResult {
        return html`<div class="list-state"><p class="state-title">Waiting for network</p><p class="state-detail">The browser reports being offline — reconnecting and retrying.</p><button class="retry-button" @click=${() => this.query.refetch()}>Retry now</button></div>`
    }

    private renderPending(): TemplateResult {
        return html`<div class="list-state">${Array.from({length: 5}, () => html`<div class="skeleton-row"></div>`)}</div>`
    }

    private renderError(error: unknown): TemplateResult {
        return html`<div class="list-state error"><p class="state-title">Could not load the feed</p><p class="state-detail">${error instanceof Error ? error.message : String(error)}</p><div class="state-actions"><button class="retry-button" @click=${() => this.query.refetch()}>Retry</button><button class="retry-button" @click=${() => navigate({kind: 'settings'})}>Change instance</button></div></div>`
    }

    private renderMore(): TemplateResult {
        if (this.query.isFetchingNextPage) return html`<span class="spinner" aria-label="Loading more"></span>`
        if (this.query.hasNextPage) return html`<span class="more-hint"></span>`
        return html`<span class="end-hint">You are all caught up</span>`
    }

    private renderList(): TemplateResult {
        return html`<div class="list-scroller" ${ref((el) => {this.listEl = el as HTMLElement | null})}><div class="list-spacer" style="height: ${this.virtualizer.totalSize}px">${this.virtualizer.virtualItems.map((item) => {const post = this.posts[item.index]; return html`<div class="list-item" data-index=${item.index} style="transform: translateY(${item.start}px)" ${ref((el) => this.virtualizer.measureElement(el as HTMLElement | null))}><lvs-post-card .post=${post}></lvs-post-card></div>`})}</div><div class="list-more">${this.renderMore()}</div></div>`
    }

    private renderState(): TemplateResult {
        const {status, error, fetchStatus} = this.query.value
        if (status === 'pending' && fetchStatus === 'paused') return this.renderPaused()
        if (status === 'pending') return this.renderPending()
        if (status === 'error') return this.renderError(error)
        if (this.posts.length === 0) return html`<div class="list-state"><p class="state-title">Nothing here yet</p></div>`
        return this.renderList()
    }

    override render(): TemplateResult {
        return html`${this.renderState()}`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-post-list': PostList
    }
}
