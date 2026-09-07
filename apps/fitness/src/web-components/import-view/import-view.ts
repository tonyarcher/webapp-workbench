import {LitElement, html, unsafeCSS} from 'lit';
import type {TemplateResult} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {parseImportText, type ParseResult} from 'fitness-core';
import {postImport} from '../../services/api';
import styles from './import-view.css?inline';

const CHUNK = 500;

@customElement('ft-import-view')
export class ImportView extends LitElement {
    static override styles = unsafeCSS(styles);

    @state() private text = '';
    @state() private result: ParseResult | null = null;
    @state() private busy = false;
    @state() private error = '';
    @state() private stored = 0;

    private onTextInput(event: Event): void {
        this.text = (event.target as HTMLTextAreaElement).value;
        this.result = null;
        this.stored = 0;
        this.error = '';
    }

    private onFileChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        void file
            .text()
            .then((text) => {
                this.text = text;
                this.result = null;
                this.stored = 0;
                this.parse();
            })
            .catch(() => {
                this.error = 'could not read file';
            });
    }

    private parse(): void {
        this.error = '';
        this.stored = 0;
        this.result = parseImportText(this.text);
    }

    private async upload(): Promise<void> {
        const result = this.result;
        if (!result || result.samples.length === 0) return;
        this.busy = true;
        this.error = '';
        this.stored = 0;
        try {
            for (let i = 0; i < result.samples.length; i += CHUNK) {
                const chunk = result.samples.slice(i, i + CHUNK);
                const res = await postImport(chunk, result.format === 'unknown' ? 'csv' : result.format);
                this.stored += res.stored;
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.error = this.stored ? `Stopped after storing ${this.stored}: ${msg}` : msg;
        } finally {
            this.busy = false;
        }
    }

    private renderSkipped(): TemplateResult {
        const skipped = this.result?.skipped ?? [];
        if (!skipped.length) return html``;
        return html`<ul class="skipped">
            ${skipped.slice(0, 30).map((s) => html`<li>${s.reason}: ${s.line}</li>`)}
        </ul>`;
    }

    override render(): TemplateResult {
        const result = this.result;
        const n = result?.samples.length ?? 0;
        const skipped = result?.skipped.length ?? 0;
        return html`
            <div class="page">
                <h1 class="title">Import</h1>
                <p class="help">Health Connect JSON or a CSV with columns metric, timestamp, value, unit.</p>
                <input class="file-input" type="file" accept=".json,.csv,.txt,application/json,text/csv,text/plain" @change=${this.onFileChange}>
                <textarea class="paste" placeholder="metric,timestamp,value,unit" .value=${this.text} @input=${this.onTextInput}></textarea>
                <div class="actions">
                    <button class="btn" @click=${this.parse}>Preview</button>
                    <button class="btn primary" ?disabled=${n === 0 || this.busy} @click=${() => void this.upload()}>
                        ${this.busy ? 'Uploading…' : 'Store samples'}
                    </button>
                </div>
                ${result ? html`<p class="summary">${n} samples · ${skipped} skipped · format ${result.format}</p>` : html``}
                ${this.stored ? html`<p class="summary">Stored ${this.stored}.</p>` : html``}
                ${this.error ? html`<p class="error">${this.error}</p>` : html``}
                ${this.renderSkipped()}
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'ft-import-view': ImportView;
    }
}
