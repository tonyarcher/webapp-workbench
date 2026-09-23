import { LitElement, css, html } from 'lit';
import type { TemplateResult } from 'lit';
import type { Order } from '@stock-game/shared';
import { cancelOrder, listOrders } from '../lib/api';
import { getQueryClient } from '../lib/queryClient';
import './sg-orders-table';
import { defineElement } from './define';

const POLL_MS = 30_000;

interface OrderCancelDetail {
    id: number;
}

export class SgOrdersView extends LitElement {
    static override styles = css`
    :host {
      display: block;
    }

    h1 {
      font-size: 22px;
      margin: 0 0 16px;
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

    .muted {
      color: var(--text-muted, #9aa4b2);
    }
  `;

    static override properties = {
        orders: { attribute: false },
        busy: { attribute: false },
        error: { attribute: false },
    };

    orders: Order[] = [];
    busy = false;
    error: string | null = null;

    private timer: number | undefined;

    override connectedCallback(): void {
        super.connectedCallback();
        void this.load();
        this.timer = window.setInterval(() => {
            void this.load(true);
        }, POLL_MS);
    }

    override disconnectedCallback(): void {
        if (this.timer !== undefined) {
            window.clearInterval(this.timer);
            this.timer = undefined;
        }
        super.disconnectedCallback();
    }

    private setError(err: unknown): void {
        this.error = err instanceof Error ? err.message : String(err);
    }

    private async load(force = false): Promise<void> {
        try {
            const orders = await getQueryClient().fetchQuery({
                queryKey: ['orders'],
                queryFn: () => listOrders(),
                ...(force ? { staleTime: 0 } : {}),
            });
            if (this.isConnected) {
                this.orders = orders;
                this.error = null;
            }
        } catch (err) {
            if (this.isConnected) this.setError(err);
        }
    }

    private async onCancel(event: CustomEvent<OrderCancelDetail>): Promise<void> {
        if (this.busy) return;
        this.busy = true;
        this.error = null;
        try {
            await cancelOrder(event.detail.id);
        } catch (err) {
            if (this.isConnected) {
                this.setError(err);
                this.busy = false;
            }
            return;
        }
        await getQueryClient().invalidateQueries({ queryKey: ['orders'] });
        await this.load();
        if (this.isConnected) this.busy = false;
    }

    override render(): TemplateResult {
        return html`
      <h1>Scheduled orders</h1>
      <div class="card">
        <sg-orders-table
          .orders=${this.orders}
          .busy=${this.busy}
          @sg-order-cancel=${this.onCancel}
        ></sg-orders-table>
        ${this.error ? html`<div class="error">${this.error}</div>` : ''}
        <p class="muted">
          Due orders fill during NYSE hours (9:30–16:00 ET) at the then-current quote. GTC stays
          pending overnight if the session is closed. Place them from the Trade page.
        </p>
      </div>
    `;
    }
}

defineElement('sg-orders-view', SgOrdersView);
