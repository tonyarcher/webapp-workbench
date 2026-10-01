import { html, LitElement, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import type { HoldingsEntry, Trade } from '@stock-game/shared';
import { fetchHoldings, listTrades } from '../lib/api';
import { getQueryClient } from '../lib/queryClient';
import './sg-holdings-table';
import './sg-trades-table';
import { defineElement } from './define';
import styles from './sg-portfolio-view.css?inline';

interface TradeSymbolDetail {
    symbol: string;
}

export class SgPortfolioView extends LitElement {
    static override styles = unsafeCSS(styles);

    static override properties = {
        holdings: { attribute: false },
        trades: { attribute: false },
        error: { attribute: false },
    };

    holdings: HoldingsEntry[] = [];
    trades: Trade[] = [];
    error: string | null = null;

    override connectedCallback(): void {
        super.connectedCallback();
        void this.load();
    }

    private setError(err: unknown): void {
        this.error = err instanceof Error ? err.message : String(err);
    }

    private async load(): Promise<void> {
        try {
            const client = getQueryClient();
            const [holdings, trades] = await Promise.all([
                client.fetchQuery({ queryKey: ['holdings'], queryFn: () => fetchHoldings() }),
                client.fetchQuery({ queryKey: ['trades'], queryFn: () => listTrades() }),
            ]);
            if (this.isConnected) {
                this.holdings = holdings;
                this.trades = trades;
                this.error = null;
            }
        } catch (err) {
            if (this.isConnected) this.setError(err);
        }
    }

    private onTradeSymbol(event: CustomEvent<TradeSymbolDetail>): void {
        window.location.hash = `#/trade?symbol=${encodeURIComponent(event.detail.symbol)}`;
    }

    override render(): TemplateResult {
        return html`
      <h1>Portfolio</h1>
      <div class="card">
        <h2>Holdings</h2>
        <p class="muted">Click a row to trade that symbol.</p>
        <sg-holdings-table
          .holdings=${this.holdings}
          @sg-trade-symbol=${this.onTradeSymbol}
        ></sg-holdings-table>
      </div>
      <div class="card">
        <h2>Trade history</h2>
        <sg-trades-table .trades=${this.trades}></sg-trades-table>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ''}
    `;
    }
}

defineElement('sg-portfolio-view', SgPortfolioView);
