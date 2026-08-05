import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, property} from 'lit/decorators.js'
import type {ScrollItem} from './types'
import styles from './media-text.css?inline'

@customElement('vsc-media-text')
export class ScrollMediaText extends LitElement {
    static override styles = unsafeCSS(styles)

    @property({attribute: false}) item!: ScrollItem

    override render(): TemplateResult {
        const {item} = this
        return html`
            <div class="text-stage">
                <h2 class="text-title">${item.title}</h2>
                ${item.body ? html`<p class="text-body">${item.body}</p>` : html`<p class="text-body empty">No body text.</p>`}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'vsc-media-text': ScrollMediaText
    }
}
