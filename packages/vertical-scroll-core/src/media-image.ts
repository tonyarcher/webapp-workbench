import {LitElement, html, nothing, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {safeUrl} from './url'
import styles from './media-image.css?inline'

const DRAG_THRESHOLD_PX = 40

@customElement('vsc-media-image')
export class ScrollMediaImage extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) images: string[] = []

    @state() private index = 0
    @state() private dragged = false

    private dragStartX = 0
    private dragDelta = 0
    private readonly onDragMove = (move: PointerEvent): void => {
        this.dragDelta = move.clientX - this.dragStartX
        if (Math.abs(this.dragDelta) > 6) this.dragged = true
        if (this.dragged) this.requestUpdate()
    }
    private readonly onDragEnd = (): void => {
        window.removeEventListener('pointermove', this.onDragMove)
        window.removeEventListener('pointerup', this.onDragEnd)
        window.removeEventListener('pointercancel', this.onDragEnd)
        if (this.dragDelta < -DRAG_THRESHOLD_PX) this.next()
        else if (this.dragDelta > DRAG_THRESHOLD_PX) this.prev()
        this.dragDelta = 0
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback()
        window.removeEventListener('pointermove', this.onDragMove)
        window.removeEventListener('pointerup', this.onDragEnd)
        window.removeEventListener('pointercancel', this.onDragEnd)
    }

    private onPointerDown(event: PointerEvent): void {
        if (event.pointerType === 'mouse') event.preventDefault()
        this.dragStartX = event.clientX
        this.dragDelta = 0
        this.dragged = false
        window.addEventListener('pointermove', this.onDragMove)
        window.addEventListener('pointerup', this.onDragEnd)
        window.addEventListener('pointercancel', this.onDragEnd)
    }

    private onClick(event: Event): void {
        if (this.dragged) {
            event.preventDefault()
            event.stopPropagation()
            this.dragged = false
        }
    }

    private next(): void {
        if (this.index < this.images.length - 1) this.index++
    }

    private prev(): void {
        if (this.index > 0) this.index--
    }

    private stop(event: Event): void {
        event.preventDefault()
        event.stopPropagation()
    }

    private renderArrows(): TemplateResult {
        if (this.images.length < 2) return html``
        return html`
            <button class="carousel-arrow prev" aria-label="Previous image" @click=${(e: Event) => {
                this.stop(e)
                this.prev()
            }}>‹</button>
            <button class="carousel-arrow next" aria-label="Next image" @click=${(e: Event) => {
                this.stop(e)
                this.next()
            }}>›</button>
        `
    }

    private renderDots(): TemplateResult | typeof nothing {
        if (this.images.length < 2) return nothing
        return html`<div class="carousel-dots">
            ${this.images.map(
                (_, i) => html`<span class="dot${i === this.index ? ' active' : ''}"></span>`,
            )}
        </div>`
    }

    override render(): TemplateResult {
        const count = this.images.length
        if (count === 0) return html``
        const single = count === 1
        return html`
            <div
                class="media-stage${this.dragged ? ' dragging' : ''}"
                @pointerdown=${this.onPointerDown}
                @click=${this.onClick}
            >
                <div class="carousel-track" style="transform: translateX(${-this.index * 100}%)">
                    ${this.images.map(
                        (src) => {
                            const safe = safeUrl(src)
                            return html`<div class="carousel-slide">
                                ${safe
                                    ? html`<img class="media-img" src=${safe} alt="" loading="lazy" draggable="false" referrerpolicy="no-referrer"/>`
                                    : html``}
                            </div>`
                        },
                    )}
                </div>
                ${single ? nothing : this.renderArrows()}
                ${this.renderDots()}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'vsc-media-image': ScrollMediaImage
    }
}
