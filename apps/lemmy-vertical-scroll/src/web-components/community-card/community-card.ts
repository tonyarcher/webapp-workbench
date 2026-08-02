import {LitElement, html, nothing, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property} from 'lit/decorators.js'
import {compactNumber} from '../../services/format'
import {safeUrl} from '../../services/url'
import {navigate} from '../../router'
import type {LemmyCommunity} from '../../types'
import styles from './community-card.css?inline'

@customElement('lvs-community-card')
export class CommunityCard extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) community!: LemmyCommunity

    private open(): void {
        navigate({kind: 'community', communityId: this.community.id})
    }

    override render(): TemplateResult {
        const {community} = this
        return html`
            <button class="community-card" @click=${this.open}>
                <div class="community-icon" aria-hidden="true">
                    ${safeUrl(community.icon)
                        ? html`<img src=${safeUrl(community.icon)} alt="" loading="lazy" referrerpolicy="no-referrer"/>`
                        : html`<span class="icon-fallback">${community.name.charAt(0).toUpperCase()}</span>`}
                </div>
                <div class="community-info">
                    <span class="community-title">${community.title}</span>
                    <span class="community-name">!${community.name}${community.local ? ' · local' : ''}</span>
                    ${community.description
                        ? html`<p class="community-description">${community.description}</p>`
                        : nothing}
                    <span class="community-stats">
                        <span class="stat">${compactNumber(community.subscribers)} subscribers</span>
                        <span class="stat">${compactNumber(community.posts)} posts</span>
                        <span class="stat">${compactNumber(community.comments)} comments</span>
                    </span>
                </div>
            </button>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-community-card': CommunityCard
    }
}
