import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {ref} from 'lit/directives/ref.js'
import {communitiesInfiniteQuery, hydrateCommunities, InfiniteQueryController} from '../../query'
import {navigate} from '../../router'
import type {CommunityPage, CommunitySort, FeedType, LemmyCommunity, NsfwFilter, Software} from '../../types'
import {VirtualizerController} from '../virtual-list'
import '../community-card/community-card'
import styles from './community-list.css?inline'

const SEARCH_DEBOUNCE_MS = 400

@customElement('lvs-community-list')
export class CommunityList extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) instance = ''
    @property({attribute: false}) type: FeedType = 'All'
    @property({attribute: false}) sort: CommunitySort = 'Hot'
    @property({attribute: false}) software: Software = 'lemmy'
    @property({attribute: false}) nsfwFilter: NsfwFilter = 'Include'
    /** Bearer jwt when logged in; '' when anonymous. */
    @property({attribute: false}) auth = ''

    private readonly query = new InfiniteQueryController<CommunityPage>(this, () =>
        communitiesInfiniteQuery(this.instance, this.type, this.sort, this.search, this.software, this.nsfwFilter, this.auth),
    )
    private readonly virtualizer = new VirtualizerController<LemmyCommunity>(
        this,
        () => this.listEl,
        () => this.communities,
        () => this.onNearEnd(),
    )
    private listEl: HTMLElement | null = null
    @state() private search = ''
    private searchTimer: ReturnType<typeof setTimeout> | null = null
    private prevSearch = ''
    private prevParams = ''
    private resetScroll = false

    override connectedCallback(): void {
        super.connectedCallback()
        void hydrateCommunities(this.instance, this.type, this.sort, '', this.nsfwFilter, this.software, this.auth)
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        if (this.searchTimer) {
            clearTimeout(this.searchTimer)
            this.searchTimer = null
        }
    }

    /** Reset to the top when the listing parameters change. */
    override willUpdate(_changed: Map<string, unknown>): void {
        const params = JSON.stringify([this.instance, this.type, this.sort, this.nsfwFilter, this.software, this.auth])
        if (this.prevParams !== '' && params !== this.prevParams) {
            this.resetScroll = true
            if (this.listEl) this.listEl.scrollTop = 0
        }
        this.prevParams = params
    }

    override updated(changed: Map<string, unknown>): void {
        super.updated(changed)
        if (this.search !== this.prevSearch) {
            this.prevSearch = this.search
            this.resetScroll = true
        }
        // apply after render too, so virtualizer scroll adjustments can't win
        if (this.resetScroll) {
            this.resetScroll = false
            if (this.listEl) this.listEl.scrollTop = 0
        }
    }

    private get communities(): LemmyCommunity[] {
        const data = this.query.value.data
        return data ? data.pages.flatMap((page) => page.communities) : []
    }

    private onNearEnd(): void {
        if (this.query.hasNextPage && !this.query.isFetchingNextPage) this.query.fetchNextPage()
    }

    private onSearchInput(event: Event): void {
        const value = (event.target as HTMLInputElement).value
        if (this.searchTimer) clearTimeout(this.searchTimer)
        this.searchTimer = setTimeout(() => {
            this.search = value.trim()
        }, SEARCH_DEBOUNCE_MS)
    }

    private renderPaused(): TemplateResult {
        return html`<div class="list-state"><p class="state-title">Waiting for network</p><p class="state-detail">The browser reports being offline — reconnecting and retrying.</p><button class="retry-button" @click=${() => this.query.refetch()}>Retry now</button></div>`
    }

    private renderPending(): TemplateResult {
        return html`<div class="list-state">${Array.from({length: 5}, () => html`<div class="skeleton-row"></div>`)}</div>`
    }

    private renderError(error: unknown): TemplateResult {
        return html`<div class="list-state error"><p class="state-title">Could not load communities</p><p class="state-detail">${error instanceof Error ? error.message : String(error)}</p><div class="state-actions"><button class="retry-button" @click=${() => this.query.refetch()}>Retry</button><button class="retry-button" @click=${() => navigate({kind: 'settings'})}>Change instance</button></div></div>`
    }

    private renderList(): TemplateResult {
        return html`<div class="list-scroller" ${ref((el) => {this.listEl = el as HTMLElement | null})}><div class="list-spacer" style="height: ${this.virtualizer.totalSize}px">${this.virtualizer.virtualItems.map((item) => {const community = this.communities[item.index]; return html`<div class="list-item" data-index=${item.index} style="transform: translateY(${item.start}px)" ${ref((el) => this.virtualizer.measureElement(el as HTMLElement | null))}><lvs-community-card .community=${community}></lvs-community-card></div>`})}</div><div class="list-more">${this.query.isFetchingNextPage ? html`<span class="spinner" aria-label="Loading more"></span>` : html`<span class="more-hint"></span>`}</div></div>`
    }

    private renderState(): TemplateResult {
        const {status, error, fetchStatus} = this.query.value
        if (status === 'pending' && fetchStatus === 'paused') return this.renderPaused()
        if (status === 'pending') return this.renderPending()
        if (status === 'error') return this.renderError(error)
        if (this.communities.length === 0) return html`<div class="list-state"><p class="state-title">No communities found</p></div>`
        return this.renderList()
    }

    override render(): TemplateResult {
        return html`
            <div class="community-header">
                <input
                    class="search-input"
                    type="search"
                    placeholder="Search communities"
                    @input=${this.onSearchInput}
                />
            </div>
            ${this.renderState()}
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-community-list': CommunityList
    }
}
