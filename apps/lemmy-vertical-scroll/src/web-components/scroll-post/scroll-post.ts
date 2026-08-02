import {LitElement, html, svg, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property} from 'lit/decorators.js'
import {classifyPost} from '../../services/post-media'
import {compactNumber, timeAgo} from '../../services/format'
import {safeUrl} from '../../services/url'
import type {LemmyPost} from '../../types'
import '../scroll-media-image/scroll-media-image'
import '../scroll-media-text/scroll-media-text'
import '../scroll-media-video/scroll-media-video'
import styles from './scroll-post.css?inline'

const UP_ICON = svg`<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 2 11 10H1Z" fill="currentColor"/></svg>`
const DOWN_ICON = svg`<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M6 10 11 2H1Z" fill="currentColor"/></svg>`
const COMMENT_ICON = svg`<svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true"><path d="M7 1C3.7 1 1 3.2 1 6c0 1.6.8 3 2.1 4-.2 1-.8 2.4-1.6 3.2-.2.2.1.6.4.5 1.5-.5 2.5-1.2 3.1-2C6 12 6.5 12 7 12c3.3 0 6-2.2 6-5S10.3 1 7 1Z" fill="currentColor"/></svg>`

@customElement('lvs-scroll-post')
export class ScrollPost extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) post!: LemmyPost
    @property({attribute: false}) active = false

    private renderMedia(): TemplateResult {
        const kind = classifyPost(this.post)
        if (kind === 'video') {
            return html`<lvs-scroll-media-video .post=${this.post} .active=${this.active}></lvs-scroll-media-video>`
        }
        if (kind === 'image') {
            return html`<lvs-scroll-media-image .images=${this.post.imageUrls}></lvs-scroll-media-image>`
        }
        if (kind === 'link' && this.post.thumbnailUrl) {
            return html`<lvs-scroll-media-image .images=${[this.post.thumbnailUrl]}></lvs-scroll-media-image>`
        }
        return html`<lvs-scroll-media-text .post=${this.post}></lvs-scroll-media-text>`
    }

    private renderLinkChip(): TemplateResult {
        if (classifyPost(this.post) !== 'link') return html``
        const link = safeUrl(this.post.linkUrl)
        if (!link) return html``
        return html`<a
            class="link-chip"
            href=${link}
            target="_blank"
            rel="noopener noreferrer"
            @click=${(e: Event) => e.stopPropagation()}
        >Open link ↗</a>`
    }

    override render(): TemplateResult {
        const {post} = this
        const isVideo = classifyPost(post) === 'video'
        const original = safeUrl(post.postUrl)
        return html`
            <div class="scroll-post">
                <div class="media-wrap">${this.renderMedia()}</div>
                ${this.renderLinkChip()}
                <div class="post-overlay${isVideo ? ' top' : ''}">
                    <div class="meta-row">
                        <span class="meta-community">${post.communityTitle}</span>
                        <span class="meta-sep">•</span>
                        <span class="meta-author">${post.creatorDisplayName ?? post.creatorName}</span>
                        <span class="meta-sep">•</span>
                        <span class="meta-time">${timeAgo(post.published)}</span>
                    </div>
                    <h3 class="post-title">${post.name}</h3>
                    <div class="stats-row">
                        <span class="stat up">${UP_ICON} ${compactNumber(post.upvotes)}</span>
                        <span class="stat down">${DOWN_ICON} ${compactNumber(post.downvotes)}</span>
                        <span class="stat">${COMMENT_ICON} ${compactNumber(post.comments)}</span>
                        ${original
                            ? html`<a class="open-link" href=${original} target="_blank" rel="noopener noreferrer">Open original ↗</a>`
                            : html``}
                    </div>
                </div>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-scroll-post': ScrollPost
    }
}
