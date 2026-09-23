import { LitElement, css, html } from 'lit';
import type { TemplateResult } from 'lit';
import type {
    GameConfig,
    HoldingsEntry,
    PlaceOrderRequest,
    PlaceTradeRequest,
    Quote,
    SymbolSearchResult,
    Trade,
} from '@stock-game/shared';
import {
    fetchCash,
    fetchConfig,
    fetchHoldings,
    fetchQuote,
    listTrades,
    placeOrder,
    placeTrade,
    searchSymbols,
} from '../lib/api';
import { getQueryClient } from '../lib/queryClient';
import './sg-trade-form';
import './sg-trades-table';
import { defineElement } from './define';

type SubmitDetail = { mode: 'backdated'; data: PlaceTradeRequest } | { mode: 'scheduled'; data: PlaceOrderRequest };

export class SgTradeView extends LitElement {
    static override styles = css`
    :host {
      display: block;
    }

    h1 {
      font-size: 22px;
      margin: 0 0 16px;
    }

    h2 {
      font-size: 17px;
      margin: 0 0 12px;
    }

    .card {
      background: var(--bg-elevated, #161b22);
      border: 1px solid var(--border, #2a313c);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .error {
      color: var(--negative, #f85149);
      font-size: 13px;
      margin-top: 8px;
    }

    .positive {
      color: var(--positive, #3fb950);
    }
  `;

    static override properties = {
        symbol: { attribute: false },
        query: { attribute: false },
        selection: { attribute: false },
        config: { attribute: false },
        holdings: { attribute: false },
        trades: { attribute: false },
        tradesError: { attribute: false },
        results: { attribute: false },
        searching: { attribute: false },
        searchError: { attribute: false },
        quote: { attribute: false },
        quoteLoading: { attribute: false },
        quoteError: { attribute: false },
        cashCents: { attribute: false },
        busy: { attribute: false },
        mutError: { attribute: false },
        mutSuccess: { attribute: false },
    };

    symbol: string | undefined;
    selection: string | undefined;
    query = '';
    config: GameConfig | null = null;
    holdings: HoldingsEntry[] = [];
    trades: Trade[] = [];
    tradesError: string | null = null;
    results: SymbolSearchResult[] = [];
    searching = false;
    searchError: string | null = null;
    quote: Quote | null = null;
    quoteLoading = false;
    quoteError: string | null = null;
    cashCents: number | null = null;
    busy = false;
    mutError: string | null = null;
    mutSuccess = false;

    override connectedCallback(): void {
        super.connectedCallback();
        this.selection = this.symbol ?? undefined;
        void this.loadBase();
        if (this.selection !== undefined) void this.loadQuote(this.selection);
    }

    private setError(err: unknown): string {
        return err instanceof Error ? err.message : String(err);
    }

    private fetchInto<T>(
        key: string[],
        queryFn: () => Promise<T>,
        apply: (value: T) => void,
        onError?: (err: unknown) => void,
    ): void {
        const client = getQueryClient();
        void client.fetchQuery({ queryKey: key, queryFn }).then(
            (value) => {
                if (this.isConnected) apply(value);
            },
            (err: unknown) => {
                if (onError !== undefined) onError(err);
            },
        );
    }

    private loadBase(): void {
        this.fetchInto(['config'], fetchConfig, (config) => {
            this.config = config;
        });
        this.fetchInto(['holdings'], fetchHoldings, (holdings) => {
            this.holdings = holdings;
        });
        this.fetchInto(['cash'], fetchCash, (cash) => {
            this.cashCents = cash;
        });
        this.fetchInto(
            ['trades'],
            listTrades,
            (trades) => {
                this.trades = trades;
                this.tradesError = null;
            },
            (err: unknown) => {
                if (this.isConnected) this.tradesError = `Failed to load trades: ${this.setError(err)}`;
            },
        );
    }

    private async loadSearch(): Promise<void> {
        const q = this.query;
        if (q.trim().length === 0) {
            this.results = [];
            this.searchError = null;
            this.searching = false;
            return;
        }
        this.searching = true;
        this.searchError = null;
        try {
            const results = await getQueryClient().fetchQuery({
                queryKey: ['search', q],
                queryFn: () => searchSymbols(q),
            });
            if (!this.isConnected || this.query !== q) return;
            this.results = results;
        } catch (err) {
            if (!this.isConnected || this.query !== q) return;
            this.searchError = this.setError(err);
        } finally {
            if (this.isConnected && this.query === q) this.searching = false;
        }
    }

    private async loadQuote(symbol: string): Promise<void> {
        this.quote = null;
        this.quoteLoading = true;
        this.quoteError = null;
        try {
            const quote = await getQueryClient().fetchQuery({
                queryKey: ['quote', symbol],
                queryFn: () => fetchQuote(symbol),
            });
            if (!this.isConnected || this.selection !== symbol) return;
            this.quote = quote;
        } catch (err) {
            if (!this.isConnected || this.selection !== symbol) return;
            this.quoteError = this.setError(err);
        } finally {
            if (this.isConnected && this.selection === symbol) this.quoteLoading = false;
        }
    }

    private onSearchInput(event: CustomEvent<{ query: string }>): void {
        this.query = event.detail.query;
        void this.loadSearch();
    }

    private onSymbolSelect(event: CustomEvent<SymbolSearchResult>): void {
        this.selection = event.detail.symbol;
        window.location.hash = `#/trade?symbol=${encodeURIComponent(event.detail.symbol)}`;
        void this.loadQuote(event.detail.symbol);
    }

    private async onSubmit(event: CustomEvent<SubmitDetail>): Promise<void> {
        if (this.busy) return;
        this.busy = true;
        this.mutError = null;
        this.mutSuccess = false;
        try {
            if (event.detail.mode === 'backdated') await placeTrade(event.detail.data);
            else await placeOrder(event.detail.data);
        } catch (err) {
            if (this.isConnected) {
                this.mutError = this.setError(err);
                this.busy = false;
            }
            return;
        }
        if (this.isConnected) this.mutSuccess = true;
        const client = getQueryClient();
        await client.invalidateQueries({ queryKey: ['trades'] });
        await client.invalidateQueries({ queryKey: ['orders'] });
        await client.invalidateQueries({ queryKey: ['holdings'] });
        await client.invalidateQueries({ queryKey: ['portfolio'] });
        await client.invalidateQueries({ queryKey: ['cash'] });
        this.loadBase();
        if (this.isConnected) this.busy = false;
    }

    private availableCash(): number {
        return this.cashCents ?? this.config?.startingCashCents ?? 0;
    }

    private renderFormCard(): TemplateResult {
        return html`
      <div class="card">
        <sg-trade-form
          .symbol=${this.selection ?? ''}
          .results=${this.results}
          .query=${this.query}
          .searching=${this.searching}
          .searchError=${this.searchError}
          .quote=${this.quote}
          .quoteLoading=${this.quoteLoading}
          .quoteError=${this.quoteError}
          .cashCents=${this.availableCash()}
          .holdings=${this.holdings}
          .busy=${this.busy}
          .commissionCents=${this.config?.commissionCentsPerTrade ?? 0}
          .quoteDelayMinutes=${this.config?.quoteDelayMinutes ?? 15}
          @sg-symbol-search-input=${this.onSearchInput}
          @sg-symbol-select=${this.onSymbolSelect}
          @sg-trade-submit=${this.onSubmit}
        ></sg-trade-form>
        ${this.formMessages()}
      </div>
    `;
    }

    private formMessages(): TemplateResult {
        return html`
      ${this.mutError ? html`<div class="error">${this.mutError}</div>` : ''}
      ${this.mutSuccess ? html`<div class="positive">Order placed.</div>` : ''}
    `;
    }

    private renderTradesCard(): TemplateResult {
        return html`
      <div class="card">
        <h2>Recent trades</h2>
        ${
            this.tradesError
                ? html`<div class="error">${this.tradesError}</div>`
                : html`<sg-trades-table .trades=${this.trades}></sg-trades-table>`
        }
      </div>
    `;
    }

    override render(): TemplateResult {
        return html`
      <h1>Trade</h1>
      ${this.renderFormCard()} ${this.renderTradesCard()}
    `;
    }
}

defineElement('sg-trade-view', SgTradeView);
