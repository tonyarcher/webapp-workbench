import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, state} from 'lit/decorators.js'
import {parseLinkList} from '../../services/parse-list'
import type {ParseResult} from '../../types'
import styles from './import-view.css?inline'

@customElement('cs-import-view')
export class ImportView extends LitElement {
    static override styles = unsafeCSS(styles)

    @state() private text = ''
    @state() private result: ParseResult | null = null

    private onTextInput(event: Event): void {
        this.text = (event.target as HTMLTextAreaElement).value
        this.result = null
    }

    private onFileChange(event: Event): void {
        const input = event.target as HTMLInputElement
        const file = input.files?.[0]
        if (!file) return
        void file
            .text()
            .then((text) => {
                this.text = text
                this.result = null
                this.parse()
            })
            .catch(() => {})
    }

    private onLoad(): void {
        this.parse()
    }

    private parse(): void {
        this.result = parseLinkList(this.text)
    }

    private emitImportParsed(): void {
        const result = this.result
        if (!result || result.items.length === 0) return
        this.dispatchEvent(new CustomEvent('import-parsed', {detail: result, bubbles: true, composed: true}))
    }

    private renderSkipped(): TemplateResult {
        const skipped = this.result?.skipped ?? []
        if (skipped.length === 0) return html``
        return html`
            <div class="skipped">
                <p class="skipped-title">${skipped.length} skipped</p>
                <ul class="skipped-list">
                    ${skipped.map(
                        (s) => html`<li class="skipped-item">
                            <span class="skipped-reason">${s.reason}</span>
                            <span class="skipped-url">${s.url}</span>
                        </li>`,
                    )}
                </ul>
                <p class="skipped-hint">Short links need the full /@user/video/{id} URL to play.</p>
            </div>
        `
    }

    override render(): TemplateResult {
        const result = this.result
        const playable = result?.items.length ?? 0
        const skipped = result?.skipped.length ?? 0
        return html`
            <div class="import">
                <h1 class="title">Clipstack</h1>
                <p class="help">Paste TikTok or Instagram links, or drop a .txt / .csv / .json — including a TikTok Like List or an Instagram data-export JSON.</p>
                <input class="file-input" type="file" accept=".txt,.csv,.json,text/plain,text/csv,application/json" @change=${this.onFileChange}>
                <textarea
                    class="paste"
                    placeholder="https://www.tiktok.com/@user/video/1234567890"
                    .value=${this.text}
                    @input=${this.onTextInput}
                ></textarea>
                <div class="actions">
                    <button class="load-button" @click=${this.onLoad}>Load list</button>
                    ${playable > 0
                        ? html`<button class="start-button" @click=${this.emitImportParsed}>Start watching (${playable})</button>`
                        : html``}
                </div>
                ${result ? html`<p class="summary">${playable} playable, ${skipped} skipped</p>` : html``}
                ${this.renderSkipped()}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cs-import-view': ImportView
    }
}