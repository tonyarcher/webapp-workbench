import {LitElement, html, nothing, unsafeCSS} from 'lit'
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

    private renderHeader(): TemplateResult {
        const {status, data, error} = this.communityController.value
        if (status === 'error') {
            return html`<div class="community-header error">
                <p class="state-title">Community not found</p>
                <p class="state-detail">${error instanceof Error ? error.message : String(error)}</p>
            </div>`
        }
        const community = data
        const banner = safeUrl(community?.banner ?? null)
        const icon = safeUrl(community?.icon ?? null)
        const instanceLink = safeUrl(community?.actorId ?? null)
        return html`<div class="community-header">
            ${banner
                ? html`<img class="community-banner" src=${banner} alt="" referrerpolicy="no-referrer"/>`
                : nothing}
            <div class="community-meta">
                <div class="community-icon" aria-hidden="true">
                    ${icon
                        ? html`<img src=${icon} alt="" referrerpolicy="no-referrer"/>`
                        : html`<span class="icon-fallback">${community ? community.name.charAt(0).toUpperCase() : '?'}</span>`}
                </div>
                <div class="community-info">
                    <span class="community-title">${community?.title ?? 'Loading…'}</span>
                    <span class="community-name">${community ? `!${community.name}${community.local ? ' · local' : ''}` : ''}</span>
                    <span class="community-stats">
                        <span class="stat">${community ? compactNumber(community.subscribers) : ''} subscribers</span>
                        <span class="stat">${community ? compactNumber(community.posts) : ''} posts</span>
                        <span class="stat">${community ? compactNumber(community.comments) : ''} comments</span>
                        ${community ? html`<span class="stat">${timeAgo(community.published)}</span>` : nothing}
                    </span>
                </div>
                ${instanceLink
                    ? html`<a class="external-link" href=${instanceLink} target="_blank" rel="noopener noreferrer">Open on instance</a>`
                    : nothing}
            </div>
            ${community?.description ? html`<p class="community-description">${community.description}</p>` : nothing}
        </div>`
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
