import { LitElement, css, html } from 'lit';
import type { TemplateResult } from 'lit';
import type { GameConfig, HoldingsEntry, PortfolioSeries } from '@stock-game/shared';
import { fetchConfig, fetchHoldings, fetchPortfolioSeries } from '../lib/api';
import { fmtMoney, fmtPct } from '../lib/format';
import { getQueryClient } from '../lib/queryClient';
import './sg-portfolio-chart';
import './sg-holdings-table';
import { defineElement } from './define';

type Settled<T> = PromiseSettledResult<T>;

function isRejected(...results: Array<Settled<unknown>>): boolean {
    return results.some((result) => result.status === 'rejected');
}

function firstRejection(...results: Array<Settled<unknown>>): unknown {
    for (const result of results) {
        if (result.status === 'rejected') return result.reason as unknown;
    }
    return null;
}

function fulfilledValue<T>(result: Settled<T>): T {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
}

export class SgDashboardView extends LitElement {
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

    .row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .stat .label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted, #9aa4b2);
    }

    .stat .value {
      font-size: 20px;
      font-weight: 600;
      margin-top: 4px;
    }

    .positive {
      color: var(--positive, #3fb950);
    }

    .negative {
      color: var(--negative, #f85149);
    }

    .muted {
      color: var(--text-muted, #9aa4b2);
    }

    .error {
      color: var(--negative, #f85149);
      font-size: 13px;
      margin-top: 8px;
    }
  `;

    static override properties = {
        config: { attribute: false },
        series: { attribute: false },
        holdings: { attribute: false },
        error: { attribute: false },
        loading: { attribute: false },
    };

    config: GameConfig | null = null;
    series: PortfolioSeries | null = null;
    holdings: HoldingsEntry[] = [];
    error: string | null = null;
    loading = true;

    override connectedCallback(): void {
        super.connectedCallback();
        void this.load();
    }

    private setError(err: unknown): void {
        this.error = err instanceof Error ? err.message : String(err);
    }

    private toPoints(series: PortfolioSeries): Array<{ time: number; value: number }> {
        return series.points.map((point) => ({ time: point.time, value: point.totalCents / 100 }));
    }

    private toGainPoints(series: PortfolioSeries): Array<{ time: number; value: number }> {
        return series.points.map((point) => ({ time: point.time, value: point.gainCents / 100 }));
    }

    private async load(): Promise<void> {
        this.loading = true;
        this.error = null;
        const client = getQueryClient();
        const [configResult, seriesResult, holdingsResult] = await Promise.allSettled([
            client.fetchQuery({ queryKey: ['config'], queryFn: () => fetchConfig() }),
            client.fetchQuery({ queryKey: ['portfolio', 'series'], queryFn: () => fetchPortfolioSeries() }),
            client.fetchQuery({ queryKey: ['holdings'], queryFn: () => fetchHoldings() }),
        ]);
        if (!this.isConnected) return;
        if (isRejected(configResult, seriesResult, holdingsResult)) {
            this.setError(firstRejection(configResult, seriesResult, holdingsResult));
            this.loading = false;
            return;
        }
        this.config = fulfilledValue(configResult);
        this.series = fulfilledValue(seriesResult);
        this.holdings = fulfilledValue(holdingsResult);
        this.loading = false;
    }

    private renderStats(series: PortfolioSeries, config: GameConfig): TemplateResult {
        const stats = this.statsFor(series, config);
        return html`
      <div class="row">
        ${this.statCard('Total value', fmtMoney(stats.totalCents), '')}
        ${this.statCard('Cash', fmtMoney(stats.cash), '')}
        ${this.statCard('Holdings', fmtMoney(stats.holdingsCents), '')}
        ${this.statCard('Total return', fmtPct(series.totalReturnPct), stats.cls)}
        ${this.statCard('Gain / Loss', fmtMoney(series.totalGainCents), stats.gainCls)}
      </div>
    `;
    }

    private statCard(label: string, value: string, cls: string): TemplateResult {
        return html`
      <div class="card stat">
        <div class="label">${label}</div>
        <div class="value ${cls}">${value}</div>
      </div>
    `;
    }

    private statsFor(
        series: PortfolioSeries,
        config: GameConfig,
    ): {
        totalCents: number;
        cash: number;
        holdingsCents: number;
        cls: string;
        gainCls: string;
    } {
        const last = series.points.at(-1);
        return {
            totalCents: last?.totalCents ?? config.startingCashCents,
            cash: last?.cashCents ?? config.startingCashCents,
            holdingsCents: last?.holdingsCents ?? 0,
            cls: series.totalReturnPct >= 0 ? 'positive' : 'negative',
            gainCls: series.totalGainCents >= 0 ? 'positive' : 'negative',
        };
    }

    override render(): TemplateResult {
        if (this.error !== null) {
            return html`<div class="card"><div class="error">${this.error}</div></div>`;
        }
        if (this.loading || this.config === null || this.series === null) {
            return html`<div class="card"><p class="muted">Loading…</p></div>`;
        }
        return html`
      <h1>Dashboard</h1>
      ${this.renderStats(this.series, this.config)}
      <div class="card">
        <h2>Value and gain/loss</h2>
        <sg-portfolio-chart
          .points=${this.toPoints(this.series)}
          .gainPoints=${this.toGainPoints(this.series)}
        ></sg-portfolio-chart>
      </div>
      <div class="card">
        <h2>Holdings</h2>
        <sg-holdings-table .holdings=${this.holdings}></sg-holdings-table>
      </div>
    `;
    }
}

defineElement('sg-dashboard-view', SgDashboardView);
