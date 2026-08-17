import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {ref} from 'lit/directives/ref.js'
import {toScrollItem} from '../../services/to-scroll-item'
import {resolveTiktokOEmbed} from '../../services/resolve-oembed'
import type {TikTokLink} from '../../types'
import type {ScrollItem, ScrollViewport} from 'vertical-scroll-core'
import 'vertical-scroll-core'
import '../progress-sidebar/progress-sidebar'
import styles from './watch-view.css?inline'

@customElement('tts-watch-view')
export class WatchView extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) items: TikTokLink[] = []
    @property({attribute: false}) skippedCount = 0
    @property({attribute: false}) startIndex = 0
    @property({attribute: false}) startMaxSeen = 0

    @state() private links: TikTokLink[] = []
    @state() private scrollItems: ScrollItem[] = []
    @state() private activeIndex = 0
    @state() private maxSeen = 0
    @state() private resetKey = ''
    @state() private sidebarOpen = false

    private viewport: ScrollViewport | null = null
    private prevItems: TikTokLink[] = []
    private resolving = new Set<string>()
    private resolveAbort: AbortController | null = null
    private listGen = 0
    /** Ad blockers return ERR_BLOCKED_BY_CLIENT for tiktok.com/oembed; stop after a couple of fails. */
    private oembedDisabled = false
    private oembedFails = 0
    private progressTimer: ReturnType<typeof setTimeout> | null = null

    override willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('items')) {
            const items = this.items
            if (items !== this.prevItems) {
                this.prevItems = items
                this.resolveAbort?.abort()
                this.resolveAbort = new AbortController()
                this.links = items.map((link) => ({...link}))
                this.scrollItems = this.links.map((link, index) => toScrollItem(link, index, this.links.length))
                this.listGen += 1
                this.resetKey = `${items[0]?.id ?? ''}:${items.length}:${this.listGen}`
                this.activeIndex = this.startIndex
                this.maxSeen = Math.max(this.startMaxSeen, this.startIndex)
                this.resolving.clear()
                this.oembedFails = 0
                this.resolveAround(this.activeIndex)
            }
        }
    }

    /** Resolve the real `/@user/video/{id}` page for the active clip and a few ahead. */
    private resolveAround(index: number): void {
        if (this.oembedDisabled) return
        const signal = this.resolveAbort?.signal
        const to = Math.min(this.links.length, index + 4)
        for (let i = index; i < to; i++) {
            const link = this.links[i]
            if (!link || link.pageUrl || this.resolving.has(link.id)) continue
            this.resolving.add(link.id)
            void resolveTiktokOEmbed(link.id, signal)
                .then((info) => {
                    if (!info || signal?.aborted) return
                    this.oembedFails = 0
                    const itemIndex = this.links.findIndex((item) => item.id === link.id)
                    if (itemIndex < 0) return
                    const current = this.links[itemIndex]
                    const next: TikTokLink = {
                        ...current,
                        author: info.author ?? current.author,
                        title: info.title ?? current.title,
                        pageUrl: info.pageUrl ?? current.pageUrl,
                        thumbnailUrl: info.thumbnailUrl ?? current.thumbnailUrl,
                    }
                    const links = this.links.slice()
                    links[itemIndex] = next
                    this.links = links
                    const scrollItems = this.scrollItems.slice()
                    scrollItems[itemIndex] = toScrollItem(next, itemIndex, links.length)
                    this.scrollItems = scrollItems
                })
                .catch(() => {
                    this.oembedFails += 1
                    if (this.oembedFails >= 2) this.oembedDisabled = true
                })
        }
    }

    /** Stable identity so the ref directive only fires on attach/detach. */
    private readonly onViewportRef = (el: Element | undefined): void => {
        this.viewport = (el as ScrollViewport | undefined) ?? null
    }

    private onActive(event: CustomEvent<{index: number}>): void {
        this.activeIndex = event.detail.index
        this.maxSeen = Math.max(this.maxSeen, event.detail.index)
        this.resolveAround(event.detail.index)
        this.scheduleProgress()
    }

    private scheduleProgress(): void {
        if (this.progressTimer !== null) clearTimeout(this.progressTimer)
        this.progressTimer = setTimeout(() => {
            this.progressTimer = null
            this.dispatchEvent(
                new CustomEvent('progress', {
                    detail: {index: this.activeIndex, maxSeen: this.maxSeen},
                    bubbles: true,
                    composed: true,
                }),
            )
        }, 300)
    }

    private onJump(event: CustomEvent<{index: number}>): void {
        this.viewport?.goToIndex(event.detail.index)
        this.sidebarOpen = false
    }

    private onBackdrop(): void {
        this.sidebarOpen = false
    }

    private onToggleSidebar(): void {
        this.sidebarOpen = !this.sidebarOpen
    }

    private emitNewList(): void {
        this.dispatchEvent(new CustomEvent('new-list', {bubbles: true, composed: true}))
    }

    override connectedCallback(): void {
        super.connectedCallback()
        window.addEventListener('keydown', this.onWindowKeydown)
        window.addEventListener('pagehide', this.flushProgress)
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        window.removeEventListener('keydown', this.onWindowKeydown)
        window.removeEventListener('pagehide', this.flushProgress)
        this.resolveAbort?.abort()
        this.resolveAbort = null
        this.flushProgress()
    }

    private readonly flushProgress = (): void => {
        if (this.progressTimer !== null) {
            clearTimeout(this.progressTimer)
            this.progressTimer = null
        }
        this.dispatchEvent(
            new CustomEvent('progress', {
                detail: {index: this.activeIndex, maxSeen: this.maxSeen},
                bubbles: true,
                composed: true,
            }),
        )
    }

    private readonly onWindowKeydown = (event: KeyboardEvent): void => {
        if (event.key === 'Escape' && this.sidebarOpen) this.sidebarOpen = false
    }

    override render(): TemplateResult {
        return html`
            <div class="watch">
                <button
                    class="rail-toggle"
                    aria-label=${this.sidebarOpen ? 'Close list' : 'Open list'}
                    aria-expanded=${this.sidebarOpen}
                    @click=${this.onToggleSidebar}
                >☰</button>
                <tts-progress-sidebar
                    class=${this.sidebarOpen ? 'sidebar open' : 'sidebar'}
                    .items=${this.links}
                    .activeIndex=${this.activeIndex}
                    .maxSeen=${this.maxSeen}
                    .skippedCount=${this.skippedCount}
                    @jump=${this.onJump}
                    @new-list=${this.emitNewList}
                    @close=${this.onBackdrop}
                ></tts-progress-sidebar>
                ${this.sidebarOpen
                    ? html`<button class="backdrop" aria-label="Close list" @click=${this.onBackdrop}></button>`
                    : html``}
                <vsc-scroll-viewport
                    .items=${this.scrollItems}
                    .resetKey=${this.resetKey}
                    .startIndex=${this.startIndex}
                    @active-index-change=${this.onActive}
                    ${ref(this.onViewportRef)}
                ></vsc-scroll-viewport>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'tts-watch-view': WatchView
    }
}