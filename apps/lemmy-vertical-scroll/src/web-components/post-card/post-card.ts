import {LitElement, html, nothing, svg, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property} from 'lit/decorators.js'
import {compactNumber, timeAgo} from '../../services/format'
import {navigate} from '../../router'
import type {LemmyPost} from '../../types'
import styles from './post-card.css?inline'

const UP_ICON = svg`<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 2 11 10H1Z" fill="currentColor"/></svg>`
const DOWN_ICON = svg`<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M6 10 11 2H1Z" fill="currentColor"/></svg>`
const COMMENT_ICON = svg`<svg viewBox="0 0 14 14" width="12" height="12" aria-hidden="true"><path d="M7 1C3.7 1 1 3.2 1 6c0 1.6.8 3 2.1 4-.2 1-.8 2.4-1.6 3.2-.2.2.1.6.4.5 1.5-.5 2.5-1.2 3.1-2C6 12 6.5 12 7 12c3.3 0 6-2.2 6-5S10.3 1 7 1Z" fill="currentColor"/></svg>`

@customElement('lvs-post-card')
export class PostCard extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) post!: LemmyPost

    private onCommunityClick(): void {
        navigate({kind: 'community', communityId: this.post.communityId})
    }

    override render(): TemplateResult {
        const {post} = this
        const meta = html`<span class="card-meta">
            <button class="link-button" @click=${this.onCommunityClick}>${post.communityTitle}</button>
            <span class="meta-sep">•</span>
            <span>${post.creatorDisplayName ?? post.creatorName}</span>
            <span class="meta-sep">•</span>
            <span>${timeAgo(post.published)}</span>
            ${post.pinnedLocal || post.pinnedCommunity ? html`<span class="badge pinned">Pinned</span>` : nothing}
            ${post.nsfw ? html`<span class="badge nsfw">NSFW</span>` : nothing}
        </span>`
        const title = post.url
            ? html`<a class="card-title" href=${post.url} target="_blank" rel="noopener noreferrer">${post.name}</a>`
            : html`<span class="card-title">${post.name}</span>`
        return html`
            <article class="post-card">
                <div class="score-column">
                    <span class="score-value">${compactNumber(post.score)}</span>
                    <span class="score-label">score</span>
                </div>
                <div class="card-body">
                    ${meta}
                    ${title}
                    ${post.body ? html`<p class="card-text">${post.body}</p>` : nothing}
                    ${post.thumbnailUrl
                        ? html`<img class="card-thumb" src=${post.thumbnailUrl} alt="" loading="lazy" referrerpolicy="no-referrer"/>`
                        : nothing}
                    <span class="card-actions">
                        <span class="stat"><span class="stat-icon up">${UP_ICON}</span>${compactNumber(post.upvotes)}</span>
                        <span class="stat"><span class="stat-icon down">${DOWN_ICON}</span>${compactNumber(post.downvotes)}</span>
                        <span class="stat"><span class="stat-icon">${COMMENT_ICON}</span>${compactNumber(post.comments)}</span>
                    </span>
                </div>
            </article>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-post-card': PostCard
    }
}
