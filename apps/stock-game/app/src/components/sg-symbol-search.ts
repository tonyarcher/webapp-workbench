import { LitElement, css, html } from 'lit'
import type { SymbolSearchResult } from '@stock-game/shared'
import { defineElement } from './define'

export class SgSymbolSearch extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
    }

    .input {
      width: 100%;
      font: inherit;
      color: var(--text, #e6edf3);
      background: var(--bg, #0d1117);
      border: 1px solid var(--border, #2a313c);
      border-radius: 8px;
      padding: 9px 12px;
    }

    .input:focus {
      outline: none;
      border-color: var(--accent, #4f9cf9);
    }

    .results {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      margin: 0;
      padding: 4px;
      list-style: none;
      background: var(--bg-elevated, #161b22);
      border: 1px solid var(--border, #2a313c);
      border-radius: 8px;
      max-height: 260px;
      overflow-y: auto;
      z-index: 10;
    }

    li {
      display: flex;
      gap: 12px;
      align-items: baseline;
      padding: 7px 8px;
      border-radius: 6px;
      cursor: pointer;
    }

    li:hover {
      background: var(--bg-hover, #1f2430);
    }

    li.status {
      cursor: default;
      color: var(--text-muted, #9aa4b2);
    }

    li.status.error {
      color: var(--negative, #f85149);
    }

    .sym {
      font-weight: 600;
      min-width: 70px;
    }

    .name {
      color: var(--text-muted, #9aa4b2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `

  static override properties = {
    placeholder: { type: String },
    results: { attribute: false },
    open: { type: Boolean },
    value: { type: String },
    query: { type: String },
    searching: { type: Boolean },
    error: { attribute: false },
  }

  placeholder = 'Search symbol or company…'
  results: SymbolSearchResult[] = []
  open = false
  value = ''
  query = ''
  searching = false
  error: string | null = null

  private debounce?: number

  override render() {
    const pending = this.value.trim() !== this.query
    return html`
      <input
        class="input"
        .value=${this.value}
        placeholder=${this.placeholder}
        @input=${(event: Event) => this.onInput(event)}
        @focus=${() => {
          this.open = true
        }}
        @keydown=${(event: KeyboardEvent) => this.onKeydown(event)}
      />
      ${this.open && this.value.trim().length > 0
        ? html`
            <ul class="results">
              ${pending || this.searching
                ? html`<li class="status">Searching…</li>`
                : this.error !== null
                  ? html`<li class="status error">${this.error}</li>`
                  : this.results.length === 0
                    ? html`<li class="status">No matches</li>`
                    : this.results.map(
                        (result) => html`
                          <li @click=${() => this.select(result)}>
                            <span class="sym">${result.symbol}</span>
                            <span class="name">${result.name}</span>
                          </li>
                        `,
                      )}
            </ul>
          `
        : ''}
    `
  }

  private onInput(event: Event): void {
    const target = event.target as HTMLInputElement
    this.value = target.value
    this.open = true
    this.dispatch('sg-symbol-input', { value: this.value })
    if (this.debounce !== undefined) window.clearTimeout(this.debounce)
    this.debounce = window.setTimeout(() => {
      this.dispatch('sg-symbol-search-input', { query: this.value.trim() })
    }, 300)
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.open = false
  }

  private select(result: SymbolSearchResult): void {
    this.value = result.symbol
    this.open = false
    this.dispatch('sg-symbol-select', result)
  }

  private dispatch(name: string, detail: unknown): void {
    this.dispatchEvent(
      new CustomEvent(name, { detail, bubbles: true, composed: true }),
    )
  }
}

defineElement('sg-symbol-search', SgSymbolSearch)
