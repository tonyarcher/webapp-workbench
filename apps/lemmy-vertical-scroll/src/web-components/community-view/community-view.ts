import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property} from 'lit/decorators.js'
import {communityQuery, hydrateCommunityPosts, QueryController} from '../../query'
import {compactNumber, timeAgo} from '../../services/format'
import {safeUrl} from '../../services/url'
import type {LemmyCommunity, NsfwFilter, PostSort, Software, ViewMode} from '../../types'
import '../post-list/post-list'
import '../scroll-feed/scroll-feed'
import styles from './community-view.css?inline'

@customElement('lvs-community-view')
export class CommunityView extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) instance = ''
    @property({attribute: false}) communityId = 0
    @property({attribute: false}) sort: PostSort = 'Hot'
    @property({attribute: false}) software: Software = 'lemmy'
    @property({attribute: false}) nsfwFilter: NsfwFilter = 'Include'
    @property({attribute: false}) viewMode: ViewMode = 'list'
    /** Bearer jwt when logged in; '' when anonymous. */
    @property({attribute: false}) auth = ''

    private readonly communityController = new QueryController<LemmyCommunity>(this, () =>
        communityQuery(this.instance, this.communityId, this.software),
    )

    override connectedCallback(): void {
        super.connectedCallback()
        void hydrateCommunityPosts(this.instance, this.communityId, this.sort, this.nsfwFilter, this.software, this.auth)
    }

    private renderHeaderError(error: unknown): TemplateResult {
        return html`<div class="community-header error"><p class="state-title">Community not found</p><p class="state-detail">${error instanceof Error ? error.message : String(error)}</p></div>`
    }

    private renderBanner(banner: string | null): TemplateResult {
        return banner ? html`<img class="community-banner" src=${banner} alt="" referrerpolicy="no-referrer"/>` : html``
    }

    private renderIcon(icon: string | null, community: LemmyCommunity | undefined): TemplateResult {
        if (icon) return html`<img src=${icon} alt="" referrerpolicy="no-referrer"/>`
        return html`<span class="icon-fallback">${community ? community.name.charAt(0).toUpperCase() : '?'}</span>`
    }

    private renderStats(community: LemmyCommunity | undefined): TemplateResult {
        if (!community) return html`<span class="community-stats"></span>`
        return html`<span class="community-stats"><span class="stat">${compactNumber(community.subscribers)} subscribers</span><span class="stat">${compactNumber(community.posts)} posts</span><span class="stat">${compactNumber(community.comments)} comments</span><span class="stat">${timeAgo(community.published)}</span></span>`
    }

    private renderExternalLink(actorId: string | null | undefined): TemplateResult {
        const instanceLink = safeUrl(actorId ?? null)
        return instanceLink ? html`<a class="external-link" href=${instanceLink} target="_blank" rel="noopener noreferrer">Open on instance</a>` : html``
    }

    private renderDescription(community: LemmyCommunity | undefined): TemplateResult {
        return community?.description ? html`<p class="community-description">${community.description}</p>` : html``
    }

    private communityLabel(community: LemmyCommunity | undefined): string {
        if (!community) return ''
        return `!${community.name}${community.local ? ' · local' : ''}`
    }

    private renderHeader(): TemplateResult {
        const {status, data, error} = this.communityController.value
        if (status === 'error') return this.renderHeaderError(error)
        const community = data
        return html`<div class="community-header">${this.renderBanner(safeUrl(community?.banner ?? null))}<div class="community-meta"><div class="community-icon" aria-hidden="true">${this.renderIcon(safeUrl(community?.icon ?? null), community)}</div><div class="community-info"><span class="community-title">${community?.title ?? 'Loading…'}</span><span class="community-name">${this.communityLabel(community)}</span>${this.renderStats(community)}</div>${this.renderExternalLink(community?.actorId)}</div>${this.renderDescription(community)}</div>`
    }

    override render(): TemplateResult {
        const posts = this.viewMode === 'scroll'
            ? html`<lvs-scroll-feed
                .instance=${this.instance}
                .sort=${this.sort}
                .software=${this.software}
                .nsfwFilter=${this.nsfwFilter}
                .communityId=${this.communityId}
                .auth=${this.auth}
            ></lvs-scroll-feed>`
            : html`<lvs-post-list
                .instance=${this.instance}
                .sort=${this.sort}
                .software=${this.software}
                .nsfwFilter=${this.nsfwFilter}
                .communityId=${this.communityId}
                .auth=${this.auth}
            ></lvs-post-list>`
        if (this.viewMode === 'scroll') {
            // scroll mode is a pure post feed — no community header, matching the feed tab
            return html`<div class="community-posts">${posts}</div>`
        }
        return html`
            ${this.renderHeader()}
            <div class="community-posts">${posts}</div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-community-view': CommunityView
    }
}
