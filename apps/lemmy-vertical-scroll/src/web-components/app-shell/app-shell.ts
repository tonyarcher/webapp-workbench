import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, state} from 'lit/decorators.js'
import {setCommunitySort, setCommunityType, setFeedType, setNsfwFilter, setPostSort, setViewMode} from '../../mutations'
import {authQuery, QueryController, settingsQuery, siteQuery} from '../../query'
import {getHistory, navigate, parseView} from '../../router'
import {communitySortsFor, postSortsFor} from '../../types'
import type {AuthSession, FeedType, NsfwFilter, PostFeedType, PostSort, Settings, SiteResult, Software, View, ViewMode} from '../../types'
import '../account-button/account-button'
import '../community-list/community-list'
import '../community-view/community-view'
import '../post-list/post-list'
import '../scroll-feed/scroll-feed'
import '../settings-view/settings-view'
import styles from './app-shell.css?inline'

@customElement('lvs-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles)

    @state() private view: View = {kind: 'feed'}

    private readonly settingsController = new QueryController<Settings>(this, () => settingsQuery())
    private readonly siteController = new QueryController<SiteResult>(this, () => {
        const instance = this.settingsController.value.data?.instance
        return instance ? siteQuery(instance) : {...siteQuery(''), enabled: false}
    })
    private readonly authController = new QueryController<AuthSession | null>(this, () =>
        authQuery(this.settingsController.value.data?.instance ?? ''),
    )
    private unlisten: (() => void) | null = null
    override connectedCallback(): void {
        super.connectedCallback()
        this.view = parseView(getHistory().location.pathname)
        this.unlisten = getHistory().subscribe(({location}) => {
            this.view = parseView(location.pathname)
        })
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        this.unlisten?.()
        this.unlisten = null
    }

    private get settings(): Settings | undefined {
        return this.settingsController.value.data
    }

    private get instance(): string {
        return this.settings?.instance ?? ''
    }

    private get software(): Software {
        return this.siteController.value.data?.software ?? 'lemmy'
    }

    private get authJwt(): string {
        return this.authController.value.data?.jwt ?? ''
    }

    private get loggedIn(): boolean {
        return !!this.authController.value.data
    }

    private onFeedTypeChange(event: Event): void {
        setFeedType((event.target as HTMLSelectElement).value as PostFeedType)
    }

    private onPostSortChange(event: Event): void {
        setPostSort((event.target as HTMLSelectElement).value as PostSort)
    }

    private onCommunitySortChange(event: Event): void {
        setCommunitySort((event.target as HTMLSelectElement).value as PostSort)
    }

    private onNsfwFilterChange(event: Event): void {
        setNsfwFilter((event.target as HTMLSelectElement).value as NsfwFilter)
    }

    private onViewModeChange(event: Event): void {
        setViewMode((event.target as HTMLSelectElement).value as ViewMode)
    }

    private renderViewModeSelect(value: ViewMode): TemplateResult {
        return html`<select class="sort-select" title="Feed view" @change=${this.onViewModeChange}>
            ${(['list', 'scroll'] as const).map(
                (mode) => html`<option value=${mode} ?selected=${mode === value}>${mode === 'list' ? 'List' : 'Scroll'}</option>`,
            )}
        </select>`
    }

    private renderNsfwSelect(value: NsfwFilter): TemplateResult {
        const labels: Record<NsfwFilter, string> = {
            Include: 'NSFW: Show',
            Exclude: 'NSFW: Hide',
            Only: 'NSFW: Only',
        }
        return html`<select class="sort-select" title="NSFW content filter" @change=${this.onNsfwFilterChange}>
            ${(['Include', 'Exclude', 'Only'] as const).map(
                (filter) => html`<option value=${filter} ?selected=${filter === value}>${labels[filter]}</option>`,
            )}
        </select>`
    }

    private onCommunityTypeChange(event: Event): void {
        setCommunityType((event.target as HTMLSelectElement).value as FeedType)
    }

    /** Post feed listing: Subscribed on both softwares, Suggested on Lemmy — only when logged in. */
    private postFeedTypes(): PostFeedType[] {
        const types: PostFeedType[] = ['All', 'Local']
        if (this.loggedIn) {
            types.push('Subscribed')
            if (this.software === 'lemmy') types.push('Suggested')
        }
        return types
    }

    /** Community listing: Subscribed on both softwares, ModeratorView on Lemmy — only when logged in. */
    private communityFeedTypes(): FeedType[] {
        const types: FeedType[] = ['All', 'Local']
        if (this.loggedIn) {
            types.push('Subscribed')
            if (this.software === 'lemmy') types.push('ModeratorView')
        }
        return types
    }

    /** Falls back to All when the saved listing is unavailable for this software/login state. */
    private clampFeedType(type: PostFeedType): PostFeedType {
        return this.postFeedTypes().includes(type) ? type : 'All'
    }

    private clampCommunityType(type: FeedType): FeedType {
        return this.communityFeedTypes().includes(type) ? type : 'All'
    }

    private renderFeedTypeSelect(value: PostFeedType, onchange: (e: Event) => void): TemplateResult {
        return html`<select class="sort-select" title="Feed listing" @change=${onchange}>
            ${this.postFeedTypes().map(
                (type) => html`<option value=${type} ?selected=${type === value}>${type}</option>`,
            )}
        </select>`
    }

    private renderCommunityTypeSelect(value: FeedType, onchange: (e: Event) => void): TemplateResult {
        return html`<select class="sort-select" title="Community listing" @change=${onchange}>
            ${this.communityFeedTypes().map(
                (type) => html`<option value=${type} ?selected=${type === value}>${type}</option>`,
            )}
        </select>`
    }

    private renderSortSelect(
        value: PostSort,
        onchange: (e: Event) => void,
        sorts: readonly PostSort[],
    ): TemplateResult {
        return html`<select class="sort-select" @change=${onchange}>
            ${sorts.map((sort) => html`<option value=${sort} ?selected=${sort === value}>${sort}</option>`)}
        </select>`
    }

    private renderContextControls(): TemplateResult {
        const settings = this.settings
        if (!settings) return html``
        const postSorts = postSortsFor(this.software)
        const communitySorts = communitySortsFor(this.software)
        switch (this.view.kind) {
            case 'feed':
                return html`
                    ${this.renderViewModeSelect(settings.viewMode)}
                    ${this.renderNsfwSelect(settings.nsfwFilter)}
                    ${this.renderFeedTypeSelect(this.clampFeedType(settings.feedType), this.onFeedTypeChange)}
                    ${this.renderSortSelect(settings.postSort, this.onPostSortChange, postSorts)}
                `
            case 'community':
                return html`
                    ${this.renderViewModeSelect(settings.viewMode)}
                    ${this.renderNsfwSelect(settings.nsfwFilter)}
                    ${this.renderSortSelect(settings.postSort, this.onPostSortChange, postSorts)}
                `
            case 'communities':
                return html`
                    ${this.renderCommunityTypeSelect(this.clampCommunityType(settings.communityType), this.onCommunityTypeChange)}
                    ${this.renderSortSelect(settings.communitySort, this.onCommunitySortChange, communitySorts)}
                `
            case 'settings':
                return html``
        }
    }

    /** Sorts the instance supports; falls back to Hot when the saved sort is unavailable. */
    private clampSort(sort: PostSort, sorts: readonly PostSort[]): PostSort {
        return sorts.includes(sort) ? sort : 'Hot'
    }

    private renderSettings(settings: Settings): TemplateResult {
        return html`<lvs-settings-view .settings=${settings} .site=${this.siteController.value.data?.site ?? null} .software=${this.software}></lvs-settings-view>`
    }

    private renderBootError(): TemplateResult {
        const detail = this.siteController.value.error instanceof Error ? this.siteController.value.error.message : String(this.siteController.value.error ?? '')
        return html`<div class="boot-error"><p class="state-title">Could not reach ${this.instance}</p><p class="state-detail">${detail}</p><div class="state-actions"><button class="retry-button" @click=${() => this.siteController.refetch()}>Retry</button><button class="retry-button" @click=${() => navigate({kind: 'settings'})}>Change instance</button></div></div>`
    }

    private renderFeed(settings: Settings, postSort: PostSort): TemplateResult {
        if (settings.viewMode === 'scroll') return html`<lvs-scroll-feed .instance=${this.instance} .feedType=${this.clampFeedType(settings.feedType)} .sort=${postSort} .software=${this.software} .nsfwFilter=${settings.nsfwFilter} .auth=${this.authJwt}></lvs-scroll-feed>`
        return html`<lvs-post-list .instance=${this.instance} .feedType=${this.clampFeedType(settings.feedType)} .sort=${postSort} .software=${this.software} .nsfwFilter=${settings.nsfwFilter} .auth=${this.authJwt}></lvs-post-list>`
    }

    private renderCommunities(settings: Settings): TemplateResult {
        return html`<lvs-community-list .instance=${this.instance} .type=${this.clampCommunityType(settings.communityType)} .sort=${this.clampSort(settings.communitySort, communitySortsFor(this.software))} .software=${this.software} .nsfwFilter=${settings.nsfwFilter} .auth=${this.authJwt}></lvs-community-list>`
    }

    private renderCommunity(settings: Settings, postSort: PostSort): TemplateResult {
        const view = this.view as {kind: 'community'; communityId: number}
        return html`<lvs-community-view .instance=${this.instance} .communityId=${view.communityId} .sort=${postSort} .software=${this.software} .nsfwFilter=${settings.nsfwFilter} .viewMode=${settings.viewMode} .auth=${this.authJwt}></lvs-community-view>`
    }

    private renderView(): TemplateResult {
        const settings = this.settings
        if (!settings) return html`<div class="boot-skeleton"></div>`
        if (this.view.kind === 'settings') return this.renderSettings(settings)
        const site = this.siteController.value
        if (site.status === 'error') return this.renderBootError()
        if (!site.data) return html`<div class="boot-skeleton"></div>`
        const postSort = this.clampSort(settings.postSort, postSortsFor(this.software))
        if (this.view.kind === 'feed') return this.renderFeed(settings, postSort)
        if (this.view.kind === 'communities') return this.renderCommunities(settings)
        return this.renderCommunity(settings, postSort)
    }

    private navClass(kind: View['kind']): string {
        return this.view.kind === kind ? 'nav-link active' : 'nav-link'
    }

    override render(): TemplateResult {
        return html`
            <header class="topbar">
                <nav class="nav">
                    <span class="brand">Lemmy Scroll</span>
                    <button class=${this.navClass('feed')} @click=${() => navigate({kind: 'feed'})}>Feed</button>
                    <button class=${this.navClass('communities')} @click=${() => navigate({kind: 'communities'})}>Communities</button>
                    <button class=${this.navClass('settings')} @click=${() => navigate({kind: 'settings'})}>Settings</button>
                </nav>
                <div class="topbar-right">
                    ${this.renderContextControls()}
                    <lvs-account-button .instance=${this.instance} .software=${this.software}></lvs-account-button>
                </div>
            </header>
            <main class="view">${this.renderView()}</main>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-app-shell': AppShell
    }
}
