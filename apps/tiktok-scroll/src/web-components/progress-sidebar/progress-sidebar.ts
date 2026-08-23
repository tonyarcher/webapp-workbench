import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property} from 'lit/decorators.js'
import {ref} from 'lit/directives/ref.js'
import type {TikTokLink} from '../../types'
import styles from './progress-sidebar.css?inline'

@customElement('tts-progress-sidebar')
export class ProgressSidebar extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) items: TikTokLink[] = []
    @property({attribute: false}) activeIndex = 0
    @property({attribute: false}) maxSeen = 0
    @property({attribute: false}) skippedCount = 0

    private list: HTMLOListElement | null = null
    private prevActiveIndex = -1

    /** Stable identity so the ref directive only fires on attach/detach. */
    private readonly onListRef = (el: Element | undefined): void => {
        this.list = (el as HTMLOListElement | null) ?? null
    }

    private emitNewList(): void {
        this.dispatchEvent(new CustomEvent('new-list', {bubbles: true, composed: true}))
    }

    private emitClose(): void {
        this.dispatchEvent(new CustomEvent('close', {bubbles: true, composed: true}))
    }

    private onJump(event: Event): void {
        const button = event.currentTarget as HTMLButtonElement
        const index = Number(button.dataset.index)
        if (Number.isNaN(index)) return
        this.dispatchEvent(new CustomEvent('jump', {detail: {index}, bubbles: true, composed: true}))
    }

    override updated(changed: Map<string, unknown>): void {
        if (changed.has('activeIndex') && this.activeIndex !== this.prevActiveIndex) {
            this.prevActiveIndex = this.activeIndex
            const list = this.list
            const active = list?.querySelector<HTMLElement>('[aria-current="true"]')
            if (list && active) {
                const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
                active.scrollIntoView({block: 'nearest', behavior})
            }
        }
    }

    override render(): TemplateResult {
        const total = this.items.length
        const progress = total > 0 ? ((this.activeIndex + 1) / total) * 100 : 0
        const skipped = this.skippedCount
        return html`
            <div class="sidebar">
                <div class="brand">
                    <svg class="brand-glyph" viewBox="0 0 64 64" role="img" aria-label="TikTok Scroll">
                        <rect width="64" height="64" rx="16" fill="#12131A"/>
                        <path d="M32 46L19.5 33.5C16.5 30.5 16.5 25.5 19.5 22.5C22.5 19.5 27.5 19.5 30.5 22.5L32 24L33.5 22.5C36.5 19.5 41.5 19.5 44.5 22.5C47.5 25.5 47.5 30.5 44.5 33.5L32 46Z" fill="#FF2E93"/>
                        <path d="M10 20V44" stroke="#3A3F58" stroke-width="3" stroke-linecap="round"/>
                        <path d="M10 16L6 22H14L10 16Z" fill="#00F0FF"/>
                        <circle cx="54" cy="20" r="2" fill="#3A3F58"/>
                        <circle cx="54" cy="32" r="2" fill="#3A3F58"/>
                        <circle cx="54" cy="44" r="2" fill="#3A3F58"/>
                    </svg>
                    <span class="brand-name">TikTok Scroll</span>
                </div>
                <div class="toolbar">
                    <button class="new-list" @click=${this.emitNewList}>New list</button>
                    <button class="close" aria-label="Close list" @click=${this.emitClose}>✕</button>
                </div>
                <div class="count">${this.activeIndex + 1} / ${total}${skipped > 0 ? ` · ${skipped} skipped` : ''}</div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <ol class="list" ${ref(this.onListRef)}>
                    ${this.items.map((item, index) => {
                        const active = index === this.activeIndex
                        const seen = index <= this.maxSeen
                        const user = item.author ? `@${item.author}` : null
                        const label = item.date && user ? `${item.date} / ${user}` : item.date ?? user ?? item.id
                        return html`<li class="row${active ? ' active' : ''}${seen ? ' seen' : ''}">
                            <button
                                class="row-button"
                                data-index=${index}
                                aria-current=${active ? 'true' : undefined}
                                @click=${this.onJump}
                            >
                                <span class="row-num">#${index + 1}</span>
                                <span class="row-label">${label}</span>
                            </button>
                        </li>`
                    })}
                </ol>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'tts-progress-sidebar': ProgressSidebar
    }
}