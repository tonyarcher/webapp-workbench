import { html, LitElement, unsafeCSS } from 'lit';
import type { TemplateResult } from 'lit';
import type { Order } from '@stock-game/shared';
import { cancelOrder, listOrders } from '../lib/api';
import { getQueryClient } from '../lib/queryClient';
import './sg-orders-table';
import { defineElement } from './define';
import styles from './sg-orders-view.css?inline';

const POLL_MS = 30_000;

interface OrderCancelDetail {
    id: number;
}

export class SgOrdersView extends LitElement {
    static override styles = unsafeCSS(styles);

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
        // A disconnect mid-cancel leaves busy=true; clear it on reconnect.
        this.busy = false;
        void this.load();
        this.timer = window.setInterval(() => {
            if (document.hidden) return;
            void this.load(true);
        }, POLL_MS);
        window.addEventListener('visibilitychange', this.onVisibility);
    }

    override disconnectedCallback(): void {
        window.removeEventListener('visibilitychange', this.onVisibility);
        if (this.timer !== undefined) {
            window.clearInterval(this.timer);
            this.timer = undefined;
        }
        super.disconnectedCallback();
    }

    private readonly onVisibility = (): void => {
        if (!document.hidden && this.isConnected) void this.load(true);
    };

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
