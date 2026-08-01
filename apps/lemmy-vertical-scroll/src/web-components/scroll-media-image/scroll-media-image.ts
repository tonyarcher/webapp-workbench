import {LitElement, html, nothing, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import styles from './scroll-media-image.css?inline'

const DRAG_THRESHOLD_PX = 40

@customElement('lvs-scroll-media-image')
export class ScrollMediaImage extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) images: string[] = []

    @state() private index = 0

    private dragStartX = 0
    private dragDelta = 0
    private dragged = false

    private onPointerDown(event: PointerEvent): void {
        if (event.pointerType === 'mouse') event.preventDefault()
        this.dragStartX = event.clientX
        this.dragDelta = 0
        this.dragged = false
        const onMove = (move: PointerEvent): void => {
            this.dragDelta = move.clientX - this.dragStartX
            if (Math.abs(this.dragDelta) > 6) this.dragged = true
            if (this.dragged) this.requestUpdate()
        }
        const onUp = (): void => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup', onUp)
            window.removeEventListener('pointercancel', onUp)
            if (this.dragDelta < -DRAG_THRESHOLD_PX) this.next()
            else if (this.dragDelta > DRAG_THRESHOLD_PX) this.prev()
            this.dragDelta = 0
        }
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
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
                        (src) => html`<div class="carousel-slide">
                            <img class="media-img" src=${src} alt="" loading="eager" draggable="false" referrerpolicy="no-referrer"/>
                        </div>`,
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
        'lvs-scroll-media-image': ScrollMediaImage
    }
}
