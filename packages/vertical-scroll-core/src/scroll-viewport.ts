import {LitElement, html, nothing, svg, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {ref} from 'lit/directives/ref.js'
import type {ScrollItem} from './types'
import {classifyScrollItem} from './media'
import {embedProviderForUrl} from './embeds'
import {ScrollSlide} from './scroll-slide'
import styles from './scroll-viewport.css?inline'

const WHEEL_THRESHOLD_PX = 40
const WHEEL_COOLDOWN_MS = 900
const PREFETCH_LOOKAHEAD = 3
const DRAG_THRESHOLD_PX = 40
/** Slides rendered on each side of the active one; keeps DOM and media work bounded. */
const SLIDE_WINDOW = 2
const VIEWPORT_PLAY_ICON = svg`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l11-6.5Z" fill="currentColor"/></svg>`
const VIEWPORT_PAUSE_ICON = svg`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 5h3.5v14H7ZM13.5 5H17v14h-3.5Z" fill="currentColor"/></svg>`

@customElement('vsc-scroll-viewport')
export class ScrollViewport extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) items: ScrollItem[] = []
    @property({attribute: false}) loading = false
    @property({attribute: false}) error: string | null = null
    @property({attribute: false}) resetKey = ''
    /** Slide to land on after mount / resetKey. Used to restore a saved position. */
    @property({attribute: false}) startIndex = 0

    @state() private activeIndex = 0
    @state() private dragging = false
    @state() private playing = false

    private viewport: HTMLElement | null = null
    private wheelDelta = 0
    private lastWheelMove = 0
    private dragStartY = 0
    private dragDelta = 0
    private scrollRaf: number | null = null
    private scrollTimer: ReturnType<typeof setTimeout> | null = null
    private prevResetKey = ''
    private startApplied = false
    /** Next/prev count from here so rapid keys can queue past an in-flight animation
     *  without pre-assigning `activeIndex` (that skipped `active-index-change`). */
    private navIndex = 0

    override connectedCallback(): void {
        super.connectedCallback()
        window.addEventListener('keydown', this.onWindowKeydown)
        // wheel must be non-passive so the container never double-scrolls
        this.addEventListener('wheel', this.onWheel, {passive: false})
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        window.removeEventListener('keydown', this.onWindowKeydown)
        this.removeEventListener('wheel', this.onWheel)
        window.removeEventListener('pointermove', this.onDragMove)
        window.removeEventListener('pointerup', this.onDragEnd)
        window.removeEventListener('pointercancel', this.onDragEnd)
        this.cancelScroll()
    }

    /** Reset when resetKey changes (a new list). Enriching items in place
     *  must not jump the viewport. Lands on startIndex, not always 0. */
    override willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('resetKey')) {
            const keyChanged = this.prevResetKey !== '' && this.prevResetKey !== this.resetKey
            if (keyChanged) {
                this.startApplied = false
                this.playing = false
            }
            this.prevResetKey = this.resetKey
        }
        if (changed.has('startIndex')) this.startApplied = false
    }

    override updated(_changed: Map<string, unknown>): void {
        this.applyStartIndex()
    }

    /** Stable identity so the ref directive only fires on attach/detach, not every render. */
    private readonly onViewportRef = (el: Element | undefined): void => {
        const viewport = el as HTMLElement | null
        if (viewport === this.viewport) return
        this.viewport = viewport
        this.startApplied = false
        if (viewport) this.applyStartIndex()
    }

    private applyStartIndex(): void {
        const viewport = this.viewport
        if (this.startApplied || !viewport || viewport.clientHeight === 0 || this.items.length === 0) return
        const target = Math.max(0, Math.min(this.startIndex, this.items.length - 1))
        viewport.scrollTop = target * viewport.clientHeight
        this.activeIndex = target
        this.navIndex = target
        this.startApplied = true
        this.onScroll()
    }

    /**
     * Jump to a slide. Used by app chrome (progress rail). Clamps to
     * `[0, items.length)`. Instant — animating through the range would
     * mount every intermediate embed (TikTok/Instagram iframes) on the way.
     */
    goToIndex(index: number): void {
        const viewport = this.viewport
        if (!viewport) return
        const target = Math.max(0, Math.min(index, this.items.length - 1))
        const to = target * viewport.clientHeight
        this.navIndex = target
        this.cancelScroll()
        viewport.classList.remove('no-snap')
        if (viewport.scrollTop === to && this.activeIndex === target) return
        viewport.scrollTop = to
        this.onScroll()
    }

    /**
     * Animates the viewport to a slide. CSS `scroll-behavior: smooth` is
     * deliberately avoided: combined with `scroll-snap-type` it makes
     * programmatic scrollTo silently fail in some browsers, so the slide
     * motion is driven by rAF on scrollTop with a custom ease. A timer
     * guarantees arrival even when the tab throttles rAF.
     */
    private makeFinish(viewport: HTMLElement, to: number): () => void {
        return () => {
            viewport.scrollTop = to
            this.onScroll()
            viewport.classList.remove('no-snap')
            this.scrollRaf = null
            this.scrollTimer = null
        }
    }

    private animateScroll(viewport: HTMLElement, from: number, to: number, finish: () => void): void {
        viewport.classList.add('no-snap')
        const start = performance.now()
        const duration = 420
        const ease = (t: number): number => 1 - Math.pow(1 - t, 3)
        const step = (now: number): void => {
            const t = Math.min(1, (now - start) / duration)
            viewport.scrollTop = from + (to - from) * ease(t)
            this.onScroll()
            if (t < 1) this.scrollRaf = requestAnimationFrame(step)
            else finish()
        }
        this.scrollRaf = requestAnimationFrame(step)
        this.scrollTimer = setTimeout(finish, duration + 150)
    }

    private scrollToSlide(index: number): void {
        const viewport = this.viewport
        if (!viewport) return
        const target = Math.max(0, Math.min(index, this.items.length - 1))
        const from = viewport.scrollTop
        const to = target * viewport.clientHeight
        this.navIndex = target
        if (from === to) {
            this.onScroll()
            return
        }
        this.cancelScroll()
        const finish = this.makeFinish(viewport, to)
        const distant = Math.abs(target - this.activeIndex) > 1
        if (distant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            finish()
            return
        }
        this.animateScroll(viewport, from, to, finish)
    }

    private cancelScroll(): void {
        if (this.scrollRaf !== null) {
            cancelAnimationFrame(this.scrollRaf)
            this.scrollRaf = null
        }
        if (this.scrollTimer !== null) {
            clearTimeout(this.scrollTimer)
            this.scrollTimer = null
        }
    }

    private nextSlide(): void {
        if (this.navIndex < this.items.length - 1) this.scrollToSlide(this.navIndex + 1)
        else this.onNearEnd()
    }

    private prevSlide(): void {
        if (this.navIndex > 0) this.scrollToSlide(this.navIndex - 1)
    }

    private onWheel(event: WheelEvent): void {
        event.preventDefault()
        this.wheelDelta += event.deltaY
        const now = performance.now()
        if (now - this.lastWheelMove < WHEEL_COOLDOWN_MS) return
        if (Math.abs(this.wheelDelta) < WHEEL_THRESHOLD_PX) return
        if (this.wheelDelta > 0) this.nextSlide()
        else this.prevSlide()
        this.wheelDelta = 0
        this.lastWheelMove = now
    }

    private isEditableTarget(target: HTMLElement | null): boolean {
        return !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'BUTTON' || target.tagName === 'A' || target.isContentEditable)
    }

    private handleKey(key: string): boolean {
        if (key === 'ArrowDown' || key === 'PageDown') {
            this.nextSlide()
            return true
        }
        if (key === ' ') {
            if (this.activeCanPlayPause()) this.toggleActivePlay()
            else this.nextSlide()
            return true
        }
        if (key === 'ArrowUp' || key === 'PageUp') {
            this.prevSlide()
            return true
        }
        return false
    }

    private onWindowKeydown = (event: KeyboardEvent): void => {
        if (!this.isConnected) return
        if (this.isEditableTarget(event.target as HTMLElement | null)) return
        if (this.handleKey(event.key)) event.preventDefault()
    }

    private onScroll(): void {
        const viewport = this.viewport
        if (!viewport || viewport.clientHeight === 0) return
        const index = Math.round(viewport.scrollTop / viewport.clientHeight)
        if (index !== this.activeIndex) {
            this.activeIndex = index
            if (this.scrollRaf === null && this.scrollTimer === null) this.navIndex = index
            if (!this.activeCanPlayPause()) this.playing = false
            this.dispatchEvent(new CustomEvent('active-index-change', {
                detail: {index},
                bubbles: true,
                composed: true,
            }))
        }
        if (index >= this.items.length - PREFETCH_LOOKAHEAD) this.onNearEnd()
    }

    private onNearEnd(): void {
        this.dispatchEvent(new CustomEvent('near-end', {bubbles: true, composed: true}))
    }

    /** Stable drag handlers so disconnect can remove them mid-gesture. */
    private readonly onDragMove = (move: PointerEvent): void => {
        this.dragDelta = move.clientY - this.dragStartY
    }
    private readonly onDragEnd = (): void => {
        window.removeEventListener('pointermove', this.onDragMove)
        window.removeEventListener('pointerup', this.onDragEnd)
        window.removeEventListener('pointercancel', this.onDragEnd)
        this.dragging = false
        if (this.dragDelta < -DRAG_THRESHOLD_PX) this.nextSlide()
        else if (this.dragDelta > DRAG_THRESHOLD_PX) this.prevSlide()
        this.dragDelta = 0
    }

    private onPointerDown(event: PointerEvent): void {
        if (event.pointerType !== 'mouse') return
        event.preventDefault()
        this.dragStartY = event.clientY
        this.dragDelta = 0
        this.dragging = true
        window.addEventListener('pointermove', this.onDragMove)
        window.addEventListener('pointerup', this.onDragEnd)
        window.addEventListener('pointercancel', this.onDragEnd)
    }

    private onRetry(): void {
        this.dispatchEvent(new CustomEvent('retry', {bubbles: true, composed: true}))
    }

    private onPlaybackChange(event: CustomEvent<{playing: boolean}>): void {
        // Inactive slides pause on leave and would clobber the chrome icon
        // when paging backward (DOM order updates the new active first).
        const active = this.renderRoot.querySelector('.slide-inner.active')
        if (active && event.composedPath().includes(active)) this.playing = event.detail.playing
    }

    /**
     * Native files and scriptable embeds (TikTok) can be driven; YouTube-style
     * iframes have no commandPlayer, and image/text slides have no player.
     */
    private activeCanPlayPause(): boolean {
        const item = this.items[this.activeIndex]
        if (!item || classifyScrollItem(item) !== 'video') return false
        const provider = embedProviderForUrl(item.videoUrl ?? item.url ?? null)
        return provider ? !!provider.commandPlayer : true
    }

    private toggleActivePlay(event?: Event): void {
        if (event?.currentTarget instanceof HTMLElement) event.currentTarget.blur()
        const slide = this.renderRoot.querySelector('.slide-inner.active vsc-scroll-slide') as ScrollSlide | null
        slide?.togglePlay()
    }

    private renderState(): TemplateResult | null {
        if (this.loading && !this.items.length) {
            return html`<div class="scroll-state"><div class="skeleton-slide"></div></div>`
        }
        if (this.error) {
            return html`<div class="scroll-state">
                <p class="state-title">Could not load the feed</p>
                <p class="state-detail">${this.error}</p>
                <div class="state-actions">
                    <button class="retry-button" @click=${this.onRetry}>Retry</button>
                </div>
            </div>`
        }
        if (!this.loading && this.items.length === 0) {
            return html`<div class="scroll-state">
                <p class="state-title">Nothing here yet</p>
            </div>`
        }
        return null
    }

    private renderSlideItem(item: ScrollItem, index: number, from: number, to: number, count: number): TemplateResult {
        const visible = index >= from && index <= to
        return html`<section class="slide" style="transform: translateY(${index * 100}%); height: ${100 / count}%">
            <div class="slide-inner${index === this.activeIndex ? ' active' : ''}">${visible ? html`<vsc-scroll-slide .item=${item} .active=${index === this.activeIndex}></vsc-scroll-slide>` : html`<div class="slide-placeholder"></div>`}</div>
        </section>`
    }

    private renderChrome(): TemplateResult {
        return html`<div class="feed-chrome"><button class="nav-arrow prev" aria-label="Previous post" @click=${this.prevSlide}>↑</button>${this.activeCanPlayPause() ? html`<button class="nav-arrow play" aria-label=${this.playing ? 'Pause video' : 'Play video'} @click=${this.toggleActivePlay}>${this.playing ? VIEWPORT_PAUSE_ICON : VIEWPORT_PLAY_ICON}</button>` : nothing}<button class="nav-arrow next" aria-label="Next post" @click=${this.nextSlide}>↓</button></div>`
    }

    private renderSlides(): TemplateResult {
        const count = this.items.length
        const from = Math.max(0, this.activeIndex - SLIDE_WINDOW)
        const to = Math.min(count - 1, this.activeIndex + SLIDE_WINDOW)
        return html`<div class="scroll-viewport${this.dragging ? ' dragging' : ''}" ${ref(this.onViewportRef)} @scroll=${this.onScroll} @pointerdown=${this.onPointerDown} @playback-change=${this.onPlaybackChange}>
                <div class="slides" style="height: ${count * 100}%">${this.items.map((item, index) => this.renderSlideItem(item, index, from, to, count))}</div>
            </div>${this.renderChrome()}`
    }

    override render(): TemplateResult {
        const state = this.renderState()
        return state ?? this.renderSlides()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'vsc-scroll-viewport': ScrollViewport
    }
}
