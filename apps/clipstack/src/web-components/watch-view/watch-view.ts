import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {ref} from 'lit/directives/ref.js'
import {toScrollItem} from '../../services/to-scroll-item'
import {resolveTiktokOEmbed} from '../../services/resolve-oembed'
import type {ClipLink} from '../../types'
import type {ScrollItem, ScrollViewport} from 'vertical-scroll-core'
import 'vertical-scroll-core'
import '../progress-sidebar/progress-sidebar'
import styles from './watch-view.css?inline'

const MAX_OEMBED_ATTEMPTS = 3

@customElement('cs-watch-view')
export class WatchView extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) items: ClipLink[] = []
    @property({attribute: false}) skippedCount = 0
    @property({attribute: false}) startIndex = 0
    @property({attribute: false}) startMaxSeen = 0

    @state() private links: ClipLink[] = []
    @state() private scrollItems: ScrollItem[] = []
    @state() private activeIndex = 0
    @state() private maxSeen = 0
    @state() private resetKey = ''
    @state() private sidebarOpen = false

    private viewport: ScrollViewport | null = null
    private prevItems: ClipLink[] = []
    private resolving = new Set<string>()
    private resolveAttempts = new Map<string, number>()
    private resolveAbort: AbortController | null = null
    private listGen = 0
    private progressTimer: ReturnType<typeof setTimeout> | null = null
    private linksSaveTimer: ReturnType<typeof setTimeout> | null = null

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
                this.resolveAttempts.clear()
                this.resolveAround(this.activeIndex)
            }
        }
    }

    private shouldResolve(link: ClipLink | undefined): boolean {
        return !!link && !link.pageUrl && link.provider !== 'instagram' && !this.resolving.has(link.id) && (this.resolveAttempts.get(link.id) ?? 0) < MAX_OEMBED_ATTEMPTS
    }

    private applyOEmbed(linkId: string, info: Awaited<ReturnType<typeof resolveTiktokOEmbed>>): void {
        if (!info) {
            this.resolveAttempts.set(linkId, (this.resolveAttempts.get(linkId) ?? 0) + 1)
            return
        }
        this.resolveAttempts.delete(linkId)
        const itemIndex = this.links.findIndex((item) => item.id === linkId)
        if (itemIndex < 0) return
        const current = this.links[itemIndex]
        const next: ClipLink = {...current, author: info.author ?? current.author, authorName: info.authorName ?? current.authorName, title: info.title ?? current.title, pageUrl: info.pageUrl ?? current.pageUrl, thumbnailUrl: info.thumbnailUrl ?? current.thumbnailUrl}
        const links = this.links.slice()
        links[itemIndex] = next
        this.links = links
        const scrollItems = this.scrollItems.slice()
        scrollItems[itemIndex] = toScrollItem(next, itemIndex, links.length)
        this.scrollItems = scrollItems
        this.scheduleLinksSave()
    }

    private resolveOne(link: ClipLink, signal: AbortSignal | undefined): void {
        this.resolving.add(link.id)
        void resolveTiktokOEmbed(link.id, signal)
            .then((info) => {
                this.resolving.delete(link.id)
                if (signal?.aborted) return
                this.applyOEmbed(link.id, info)
            })
            .catch((err: unknown) => {
                this.resolving.delete(link.id)
                if (signal?.aborted || (err instanceof DOMException && err.name === 'AbortError')) return
                this.resolveAttempts.set(link.id, (this.resolveAttempts.get(link.id) ?? 0) + 1)
            })
    }

    private resolveAround(index: number): void {
        const signal = this.resolveAbort?.signal
        const to = Math.min(this.links.length, index + 4)
        for (let i = index; i < to; i++) {
            const link = this.links[i]
            if (!this.shouldResolve(link)) continue
            this.resolveOne(link!, signal)
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

    private scheduleLinksSave(): void {
        if (this.linksSaveTimer !== null) clearTimeout(this.linksSaveTimer)
        this.linksSaveTimer = setTimeout(() => {
            this.linksSaveTimer = null
            this.dispatchEvent(
                new CustomEvent('links-enriched', {
                    detail: {items: this.links},
                    bubbles: true,
                    composed: true,
                }),
            )
        }, 400)
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
        if (this.linksSaveTimer !== null) {
            clearTimeout(this.linksSaveTimer)
            this.linksSaveTimer = null
        }
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
                <cs-progress-sidebar
                    class=${this.sidebarOpen ? 'sidebar open' : 'sidebar'}
                    .items=${this.links}
                    .activeIndex=${this.activeIndex}
                    .maxSeen=${this.maxSeen}
                    .skippedCount=${this.skippedCount}
                    @jump=${this.onJump}
                    @new-list=${this.emitNewList}
                    @close=${this.onBackdrop}
                ></cs-progress-sidebar>
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
        'cs-watch-view': WatchView
    }
}