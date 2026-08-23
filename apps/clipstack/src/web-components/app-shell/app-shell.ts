import {LitElement, html, unsafeCSS} from 'lit'
import type {TemplateResult} from 'lit'
import {customElement, state} from 'lit/decorators.js'
import type {ParseResult, SavedSession, ClipLink} from '../../types'
import {clearSession, loadSession, saveProgress, saveSession, saveSessionItems} from '../../services/session-store'
import '../import-view/import-view'
import '../watch-view/watch-view'
import styles from './app-shell.css?inline'

@customElement('cs-app-shell')
export class AppShell extends LitElement {
    static override styles = unsafeCSS(styles)

    @state() private result: ParseResult | null = null
    @state() private startIndex = 0
    @state() private startMaxSeen = 0

    override connectedCallback(): void {
        super.connectedCallback()
        const saved = loadSession()
        if (saved) this.applySession(saved)
    }

    private applySession(saved: SavedSession): void {
        this.result = {items: saved.items, skipped: saved.skipped}
        this.startIndex = Math.min(saved.activeIndex, saved.items.length - 1)
        this.startMaxSeen = Math.min(Math.max(saved.maxSeen, this.startIndex), saved.items.length - 1)
    }

    private persistList(activeIndex: number, maxSeen: number): void {
        const result = this.result
        if (!result || result.items.length === 0) return
        saveSession({
            version: 1,
            items: result.items,
            skipped: result.skipped,
            activeIndex,
            maxSeen,
        })
    }

    private onImportParsed(event: CustomEvent<ParseResult>): void {
        this.result = event.detail
        this.startIndex = 0
        this.startMaxSeen = 0
        this.persistList(0, 0)
    }

    private onNewList(): void {
        this.result = null
        this.startIndex = 0
        this.startMaxSeen = 0
        clearSession()
    }

    private onProgress(event: CustomEvent<{index: number; maxSeen: number}>): void {
        saveProgress(event.detail.index, event.detail.maxSeen)
    }

    /** Persist oEmbed author/title without replacing the items reference
     *  (that would remount the watch view and abort in-flight probes). */
    private onLinksEnriched(event: CustomEvent<{items: ClipLink[]}>): void {
        if (event.detail.items.length === 0) return
        saveSessionItems(event.detail.items)
    }

    override render(): TemplateResult {
        const result = this.result
        if (result && result.items.length > 0) {
            return html`<cs-watch-view
                .items=${result.items}
                .skippedCount=${result.skipped.length}
                .startIndex=${this.startIndex}
                .startMaxSeen=${this.startMaxSeen}
                @new-list=${this.onNewList}
                @progress=${this.onProgress}
                @links-enriched=${this.onLinksEnriched}
            ></cs-watch-view>`
        }
        return html`<cs-import-view @import-parsed=${this.onImportParsed}></cs-import-view>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'cs-app-shell': AppShell
    }
}
