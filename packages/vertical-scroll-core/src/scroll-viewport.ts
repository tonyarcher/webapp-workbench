import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {ref} from 'lit/directives/ref.js'
import type {ScrollItem} from './types'
import './scroll-slide'
import styles from './scroll-viewport.css?inline'

const WHEEL_THRESHOLD_PX = 40
const WHEEL_COOLDOWN_MS = 900
const PREFETCH_LOOKAHEAD = 3
const DRAG_THRESHOLD_PX = 40
/** Slides rendered on each side of the active one; keeps DOM and media work bounded. */
const SLIDE_WINDOW = 2

@customElement('vsc-scroll-viewport')
export class ScrollViewport extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) items: ScrollItem[] = []
    @property({attribute: false}) loading = false
    @property({attribute: false}) error: string | null = null
    @property({attribute: false}) resetKey = ''

    @state() private activeIndex = 0
    @state() private dragging = false

    private viewport: HTMLElement | null = null
    private wheelDelta = 0
    private lastWheelMove = 0
    private dragStartY = 0
    private dragDelta = 0
    private scrollRaf: number | null = null
    private scrollTimer: ReturnType<typeof setTimeout> | null = null
    private prevResetKey = ''
    private prevItems: ScrollItem[] = []

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

    /** Reset to the top when the resetKey or items identity changes. */
    override willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('resetKey') || changed.has('items')) {
            const keyChanged = this.prevResetKey !== '' && this.prevResetKey !== this.resetKey
            const itemsChanged = this.prevItems.length > 0 && this.prevItems !== this.items
            if (keyChanged || itemsChanged) {
                if (this.viewport) this.viewport.scrollTop = 0
                this.activeIndex = 0
            }
            this.prevResetKey = this.resetKey
            this.prevItems = this.items
        }
    }

    /** Stable identity so the ref directive only fires on attach/detach, not every render. */
    private readonly onViewportRef = (el: Element | undefined): void => {
        const viewport = el as HTMLElement | null
        if (viewport === this.viewport) return
        this.viewport = viewport
        if (viewport) {
            viewport.scrollTop = 0
            this.activeIndex = 0
        }
    }

    /**
     * Animates the viewport to a slide. CSS `scroll-behavior: smooth` is
     * deliberately avoided: combined with `scroll-snap-type` it makes
     * programmatic scrollTo silently fail in some browsers, so the slide
     * motion is driven by rAF on scrollTop with a custom ease. A timer
     * guarantees arrival even when the tab throttles rAF.
     */
    private scrollToSlide(index: number): void {
        const viewport = this.viewport
        if (!viewport) return
        const target = Math.max(0, Math.min(index, this.items.length - 1))
        const from = viewport.scrollTop
        const to = target * viewport.clientHeight
        if (from === to) return
        this.activeIndex = target
        this.cancelScroll()
        const finish = (): void => {
            viewport.scrollTop = to
            this.onScroll()
            viewport.classList.remove('no-snap')
            this.scrollRaf = null
            this.scrollTimer = null
        }
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            finish()
            return
        }
        viewport.classList.add('no-snap')
        const start = performance.now()
        const duration = 420
        const ease = (t: number): number => 1 - Math.pow(1 - t, 3)
        const step = (now: number): void => {
            const t = Math.min(1, (now - start) / duration)
            viewport.scrollTop = from + (to - from) * ease(t)
            this.onScroll()
            if (t < 1) {
                this.scrollRaf = requestAnimationFrame(step)
            } else {
                finish()
            }
        }
        this.scrollRaf = requestAnimationFrame(step)
        this.scrollTimer = setTimeout(finish, duration + 150)
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
        if (this.activeIndex < this.items.length - 1) this.scrollToSlide(this.activeIndex + 1)
        else this.onNearEnd()
    }

    private prevSlide(): void {
        if (this.activeIndex > 0) this.scrollToSlide(this.activeIndex - 1)
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

    private onWindowKeydown = (event: KeyboardEvent): void => {
        if (!this.isConnected) return
        const target = event.target as HTMLElement | null
        // never hijack keys from form controls or links
        if (
            target &&
            (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.tagName === 'BUTTON' ||
                target.tagName === 'A' ||
                target.isContentEditable)
        ) {
            return
        }
        switch (event.key) {
            case 'ArrowDown':
            case 'PageDown':
            case ' ':
                event.preventDefault()
                this.nextSlide()
                break
            case 'ArrowUp':
            case 'PageUp':
                event.preventDefault()
                this.prevSlide()
                break
        }
    }

    private onScroll(): void {
        const viewport = this.viewport
        if (!viewport || viewport.clientHeight === 0) return
        const index = Math.round(viewport.scrollTop / viewport.clientHeight)
        if (index !== this.activeIndex) {
            this.activeIndex = index
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

    private renderSlides(): TemplateResult {
        const count = this.items.length
        const from = Math.max(0, this.activeIndex - SLIDE_WINDOW)
        const to = Math.min(count - 1, this.activeIndex + SLIDE_WINDOW)
        return html`
            <div
                class="scroll-viewport${this.dragging ? ' dragging' : ''}"
                ${ref(this.onViewportRef)}
                @scroll=${this.onScroll}
                @pointerdown=${this.onPointerDown}
            >
                <!-- the track is count viewports tall; every slide is exactly one
                     viewport, positioned by index. Non-window slides stay as cheap
                     placeholders so scroll-snap anchors and geometry stay correct. -->
                <div class="slides" style="height: ${count * 100}%">
                    ${this.items.map((item, index) => {
                        const visible = index >= from && index <= to
                        return html`<section class="slide" style="transform: translateY(${index * 100}%); height: ${100 / count}%">
                            <div class="slide-inner${index === this.activeIndex ? ' active' : ''}">
                                ${visible
                                    ? html`<vsc-scroll-slide .item=${item} .active=${index === this.activeIndex}></vsc-scroll-slide>`
                                    : html`<div class="slide-placeholder"></div>`}
                            </div>
                        </section>`
                    })}
                </div>
            </div>
            <div class="feed-chrome">
                <button class="nav-arrow prev" aria-label="Previous post" @click=${this.prevSlide}>↑</button>
                <button class="nav-arrow next" aria-label="Next post" @click=${this.nextSlide}>↓</button>
            </div>
        `
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
