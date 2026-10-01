import { html, LitElement, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import type { SymbolSearchResult } from '@stock-game/shared';
import { defineElement } from './define';
import styles from './sg-symbol-search.css?inline';

export class SgSymbolSearch extends LitElement {
    static override styles = unsafeCSS(styles);

    static override properties = {
        placeholder: { type: String },
        results: { attribute: false },
        open: { type: Boolean },
        value: { type: String },
        query: { type: String },
        searching: { type: Boolean },
        error: { attribute: false },
    };

    placeholder = 'Search symbol or company…';
    results: SymbolSearchResult[] = [];
    open = false;
    value = '';
    query = '';
    searching = false;
    error: string | null = null;

    private debounce?: number;

    private renderInput(): TemplateResult {
        return html`<input
      class="input"
      .value=${this.value}
      placeholder=${this.placeholder}
      @input=${(event: Event) => this.onInput(event)}
      @focus=${() => {
          this.open = true;
      }}
      @keydown=${(event: KeyboardEvent) => this.onKeydown(event)}
    />`;
    }

    private renderStatus(text: string, error = false): TemplateResult {
        return html`<li class=${error ? 'status error' : 'status'}>${text}</li>`;
    }

    private renderResultItems(): TemplateResult {
        return html`${this.results.map(
            (result) => html`
        <li>
          <button type="button" class="result" @click=${() => this.select(result)}>
            <span class="sym">${result.symbol}</span>
            <span class="name">${result.name}</span>
          </button>
        </li>
      `,
        )}`;
    }

    private renderListContent(): TemplateResult {
        const pending = this.value.trim() !== this.query;
        if (pending || this.searching) return this.renderStatus('Searching…');
        if (this.error !== null) return this.renderStatus(this.error, true);
        if (this.results.length === 0) return this.renderStatus('No matches');
        return this.renderResultItems();
    }

    private renderResults(): TemplateResult {
        if (!this.open || this.value.trim().length === 0) return html``;
        return html`<ul class="results">${this.renderListContent()}</ul>`;
    }

    override render(): TemplateResult {
        return html`${this.renderInput()} ${this.renderResults()}`;
    }

    private onInput(event: Event): void {
        const target = event.target as HTMLInputElement;
        this.value = target.value;
        this.open = true;
        this.dispatch('sg-symbol-input', { value: this.value });
        if (this.debounce !== undefined) window.clearTimeout(this.debounce);
        this.debounce = window.setTimeout(() => {
            this.dispatch('sg-symbol-search-input', { query: this.value.trim() });
        }, 300);
    }

    private onKeydown(event: KeyboardEvent): void {
        if (event.key === 'Escape') this.open = false;
    }

    private select(result: SymbolSearchResult): void {
        this.value = result.symbol;
        this.open = false;
        this.dispatch('sg-symbol-select', result);
    }

    private dispatch(name: string, detail: unknown): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }
}

defineElement('sg-symbol-search', SgSymbolSearch);
