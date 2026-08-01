import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property} from 'lit/decorators.js'
import type {LemmyPost} from '../../types'
import styles from './scroll-media-text.css?inline'

@customElement('lvs-scroll-media-text')
export class ScrollMediaText extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) post!: LemmyPost

    override render(): TemplateResult {
        const {post} = this
        return html`
            <div class="text-stage">
                <h2 class="text-title">${post.name}</h2>
                ${post.body ? html`<p class="text-body">${post.body}</p>` : html`<p class="text-body empty">No body text.</p>`}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'lvs-scroll-media-text': ScrollMediaText
    }
}
