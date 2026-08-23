import {LitElement, html, nothing, svg, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property, state} from 'lit/decorators.js'
import {classifyScrollItem} from './media'
import {embedProviderForUrl} from './embeds'
import {compactNumber, timeAgo} from './format'
import {safeUrl} from './url'
import type {ScrollItem} from './types'
import {ScrollMediaVideo} from './media-video'
import './media-image'
import './media-text'
import styles from './scroll-slide.css?inline'

const UP_ICON = svg`<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 2 11 10H1Z" fill="currentColor"/></svg>`
const DOWN_ICON = svg`<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 10 11 2H1Z" fill="currentColor"/></svg>`
const COMMENT_ICON = svg`<svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true"><path d="M7 1C3.7 1 1 3.2 1 6c0 1.6.8 3 2.1 4-.2 1-.8 2.4-1.6 3.2-.2.2.1.6.4.5 1.5-.5 2.5-1.2 3.1-2C6 12 6.5 12 7 12c3.3 0 6-2.2 6-5S10.3 1 7 1Z" fill="currentColor"/></svg>`
const EXPAND_ICON = svg`<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 6.5 8 10.5 12 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const COLLAPSE_ICON = svg`<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 9.5 8 5.5 12 9.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`

@customElement('vsc-scroll-slide')
export class ScrollSlide extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) item!: ScrollItem
    @property({attribute: false}) active = false

    @state() private expanded = false

    override willUpdate(changed: Map<string, unknown>): void {
        if (changed.has('item')) {
            this.expanded = classifyScrollItem(this.item ?? ({title: ''} as ScrollItem)) !== 'video'
        }
    }

    private toggleExpanded(): void {
        this.expanded = !this.expanded
    }

    togglePlay(): void {
        const video = this.renderRoot.querySelector('vsc-media-video') as ScrollMediaVideo | null
        video?.togglePlay()
    }

    private renderMedia(): TemplateResult {
        const kind = classifyScrollItem(this.item)
        if (kind === 'video') {
            return html`<vsc-media-video .item=${this.item} .active=${this.active}></vsc-media-video>`
        }
        if (kind === 'image') {
            return html`<vsc-media-image .images=${this.item.imageUrls ?? []}></vsc-media-image>`
        }
        if (kind === 'link' && this.item.thumbnailUrl) {
            return html`<vsc-media-image .images=${[this.item.thumbnailUrl]}></vsc-media-image>`
        }
        return html`<vsc-media-text .item=${this.item}></vsc-media-text>`
    }

    private renderLinkChip(): TemplateResult {
        if (classifyScrollItem(this.item) !== 'link') return html``
        const link = safeUrl(this.item.linkUrl ?? null)
        if (!link) return html``
        return html`<a
            class="link-chip"
            href=${link}
            target="_blank"
            rel="noopener noreferrer"
            @click=${(e: Event) => e.stopPropagation()}
        >Open link ↗</a>`
    }

    private renderStats(): TemplateResult {
        const {stats} = this.item
        if (!stats) return html``
        return html`<span class="stats-row">
            <span class="stat up">${UP_ICON} ${compactNumber(stats.up)}</span>
            <span class="stat down">${DOWN_ICON} ${compactNumber(stats.down)}</span>
            <span class="stat">${COMMENT_ICON} ${compactNumber(stats.comments)}</span>
        </span>`
    }

    override render(): TemplateResult {
        const {item} = this
        const isVideo = classifyScrollItem(item) === 'video'
        const original = safeUrl(item.originalUrl ?? null)
        const subtitle = item.metaLine ?? (item.date ? timeAgo(item.date) : null)
        // TikTok player/v1 hides its own author/caption (description=0), so
        // the slide owns a letterbox meta stack instead of the app overlay bar.
        const isTiktokEmbed = embedProviderForUrl(item.videoUrl ?? item.url ?? null)?.name === 'tiktok'
        if (isTiktokEmbed) {
            const authorLabel = item.author ? `@${item.author}` : null
            // Profile link for the byline. Author handles are [A-Za-z0-9._-];
            // encode anyway and let safeUrl have final say on the scheme.
            const authorUrl = item.author
                ? safeUrl(`https://www.tiktok.com/@${encodeURIComponent(item.author)}`)
                : null
            const caption = item.title && item.title !== authorLabel && item.title !== `TikTok ${item.id}` ? item.title : null
            const metaEmpty = !authorLabel && !caption && !original
            return html`
                <div class="scroll-slide">
                    <div class="media-wrap">${this.renderMedia()}</div>
                    ${metaEmpty
                        ? nothing
                        : html`<div class="slide-meta">
                            ${authorLabel && authorUrl
                                ? html`<a class="meta-author" href=${authorUrl} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>${authorLabel}</a>`
                                : authorLabel
                                    ? html`<div class="meta-author">${authorLabel}</div>`
                                    : nothing}
                            ${caption ? html`<div class="meta-caption">${caption}</div>` : nothing}
                            ${original ? html`<a class="meta-open" href=${original} target="_blank" rel="noopener noreferrer" @click=${(e: Event) => e.stopPropagation()}>Open original ↗</a>` : nothing}
                        </div>`}
                </div>
            `
        }
        return html`
            <div class="scroll-slide">
                <div class="media-wrap">${this.renderMedia()}</div>
                ${this.renderLinkChip()}
                <div class="slide-overlay${isVideo ? ' video' : ''}${this.expanded ? ' expanded' : ''}">
                    <div class="overlay-bar">
                        ${subtitle ? html`<div class="meta-row"><span class="meta-text">${subtitle}</span></div>` : nothing}
                        <div class="overlay-actions">
                            ${this.renderStats()}
                            ${original
                                ? html`<a class="open-link" href=${original} target="_blank" rel="noopener noreferrer">Open original ↗</a>`
                                : nothing}
                            <button
                                class="expand-button"
                                aria-label=${this.expanded ? 'Collapse post info' : 'Show post info'}
                                @click=${this.toggleExpanded}
                            >${this.expanded ? COLLAPSE_ICON : EXPAND_ICON}</button>
                        </div>
                    </div>
                    ${this.expanded ? html`<h3 class="slide-title">${item.title}</h3>` : nothing}
                </div>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'vsc-scroll-slide': ScrollSlide
    }
}
