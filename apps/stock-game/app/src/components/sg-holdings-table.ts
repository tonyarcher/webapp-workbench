import { LitElement, html } from 'lit';
import type { TemplateResult } from 'lit';
import type { HoldingsEntry } from '@stock-game/shared';
import { fmtMoney, fmtMoneySigned, fmtNumber, fmtPct, fmtPrice } from '../lib/format';
import { tableStyles } from './shared-styles';
import { defineElement } from './define';

type SortKey =
    'symbol' | 'qty' | 'avgCostCents' | 'currentPrice' | 'marketValueCents' | 'unrealizedPnlCents' | 'unrealizedPnlPct';

type SortDir = 'asc' | 'desc';

interface Column {
    id: SortKey;
    label: string;
}

const COLUMNS: Column[] = [
    { id: 'symbol', label: 'Symbol' },
    { id: 'qty', label: 'Shares' },
    { id: 'avgCostCents', label: 'Avg Cost' },
    { id: 'currentPrice', label: 'Price' },
    { id: 'marketValueCents', label: 'Value' },
    { id: 'unrealizedPnlCents', label: 'Unrealized' },
    { id: 'unrealizedPnlPct', label: 'Return' },
];

function compareHoldings(a: HoldingsEntry, b: HoldingsEntry, key: SortKey): number {
    if (key === 'symbol') return a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0;
    return Number(a[key]) - Number(b[key]);
}

function formatCellValue(id: string, value: unknown): string {
    const num = Number(value);
    if (id === 'symbol') return String(value);
    if (id === 'qty') return fmtNumber(num);
    if (id === 'avgCostCents') return fmtMoney(num);
    if (id === 'currentPrice') return fmtPrice(num);
    if (id === 'marketValueCents') return fmtMoney(num);
    if (id === 'unrealizedPnlCents') return fmtMoneySigned(num);
    if (id === 'unrealizedPnlPct') return fmtPct(num);
    return String(value);
}

function cellClassName(id: string, value: number): string {
    const parts: string[] = [];
    if (id !== 'symbol') parts.push('num');
    if (id === 'unrealizedPnlCents' || id === 'unrealizedPnlPct') {
        parts.push(value >= 0 ? 'positive' : 'negative');
    }
    return parts.join(' ');
}

export class SgHoldingsTable extends LitElement {
    static override styles = tableStyles;

    static override properties = {
        holdings: { attribute: false },
        sortKey: { attribute: false },
        sortDir: { attribute: false },
    };

    holdings: HoldingsEntry[] = [];
    sortKey: SortKey | null = null;
    sortDir: SortDir = 'asc';

    private sortedHoldings(): HoldingsEntry[] {
        if (!this.sortKey) return this.holdings;
        const key = this.sortKey;
        const dir = this.sortDir === 'asc' ? 1 : -1;
        return [...this.holdings].sort((a, b) => compareHoldings(a, b, key) * dir);
    }

    private onSort(key: SortKey): void {
        if (this.sortKey !== key) {
            this.sortKey = key;
            this.sortDir = 'asc';
        } else if (this.sortDir === 'asc') {
            this.sortDir = 'desc';
        } else {
            this.sortKey = null;
            this.sortDir = 'asc';
        }
    }

    private onRowClick(symbol: string): void {
        this.dispatchEvent(
            new CustomEvent('sg-trade-symbol', {
                detail: { symbol },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private renderHeaderCell(column: Column): TemplateResult {
        const sorted = this.sortKey === column.id ? this.sortDir : null;
        const indicator = sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : '';
        const cls = column.id === 'symbol' ? '' : 'num';
        return html`<th class=${cls} @click=${() => this.onSort(column.id)}>
      ${column.label}${indicator}
    </th>`;
    }

    private renderRow(holding: HoldingsEntry): TemplateResult {
        return html`<tr @click=${() => this.onRowClick(holding.symbol)}>
      ${COLUMNS.map((column) => this.renderCell(column.id, holding))}
    </tr>`;
    }

    override render(): TemplateResult {
        return html`
      <table class="sg-table">
        <thead>
          <tr>
            ${COLUMNS.map((column) => this.renderHeaderCell(column))}
          </tr>
        </thead>
        <tbody>
          ${this.sortedHoldings().map((holding) => this.renderRow(holding))}
        </tbody>
      </table>
    `;
    }

    private renderCell(id: SortKey, holding: HoldingsEntry): TemplateResult {
        const raw: string | number = holding[id];
        const value = Number(raw);
        const className = cellClassName(id, value);
        const text = formatCellValue(id, raw);
        return html`<td class=${className}>${text}</td>`;
    }
}

defineElement('sg-holdings-table', SgHoldingsTable);
