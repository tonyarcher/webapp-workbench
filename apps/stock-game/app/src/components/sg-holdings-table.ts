import { LitElement, html } from 'lit'
import { property } from 'lit/decorators.js'
import type { PropertyValues, TemplateResult } from 'lit'
import {
  createColumnHelper,
  createTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/table-core'
import type { Cell, Table } from '@tanstack/table-core'
import type { HoldingsEntry } from '@stock-game/shared'
import { fmtMoney, fmtMoneySigned, fmtNumber, fmtPct, fmtPrice } from '../lib/format'
import { tableStyles } from './shared-styles'
import { defineElement } from './define'

const columnHelper = createColumnHelper<HoldingsEntry>()

const columns = [
  columnHelper.accessor('symbol', { header: 'Symbol', sortingFn: 'text' }),
  columnHelper.accessor('qty', { header: 'Shares', sortingFn: 'basic' }),
  columnHelper.accessor('avgCostCents', { header: 'Avg Cost', sortingFn: 'basic' }),
  columnHelper.accessor('currentPrice', { header: 'Price', sortingFn: 'basic' }),
  columnHelper.accessor('marketValueCents', { header: 'Value', sortingFn: 'basic' }),
  columnHelper.accessor('unrealizedPnlCents', { header: 'Unrealized', sortingFn: 'basic' }),
  columnHelper.accessor('unrealizedPnlPct', { header: 'Return', sortingFn: 'basic' }),
]

const HEADER_LABELS: Record<string, string> = {
  symbol: 'Symbol',
  qty: 'Shares',
  avgCostCents: 'Avg Cost',
  currentPrice: 'Price',
  marketValueCents: 'Value',
  unrealizedPnlCents: 'Unrealized',
  unrealizedPnlPct: 'Return',
}

export class SgHoldingsTable extends LitElement {
  static override styles = tableStyles

  @property({ attribute: false }) holdings: HoldingsEntry[] = []

  private table: Table<HoldingsEntry>

  constructor() {
    super()
    this.table = createTable<HoldingsEntry>({
      data: [],
      columns,
      state: { sorting: [] },
      onStateChange: (updater) => {
        const next = typeof updater === 'function' ? updater(this.table.getState()) : updater
        void next
        this.requestUpdate()
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getRowId: (row) => row.symbol,
      renderFallbackValue: '',
    })
  }

  override willUpdate(changed: PropertyValues): void {
    if (changed.has('holdings')) {
      this.table.setOptions((prev) => ({ ...prev, data: this.holdings }))
    }
  }

  private onRowClick(symbol: string): void {
    this.dispatchEvent(
      new CustomEvent('sg-trade-symbol', {
        detail: { symbol },
        bubbles: true,
        composed: true,
      }),
    )
  }

  override render() {
    const rows = this.table.getRowModel().rows
    return html`
      <table class="sg-table">
        <thead>
          ${this.table.getHeaderGroups().map(
            (group) => html`
              <tr>
                ${group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return html`
                    <th
                      class=${header.column.id === 'symbol' ? '' : 'num'}
                      @click=${() => header.column.toggleSorting()}
                    >
                      ${HEADER_LABELS[header.column.id] ?? header.column.id}
                      ${sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : ''}
                    </th>
                  `
                })}
              </tr>
            `,
          )}
        </thead>
        <tbody>
          ${rows.map(
            (row) => html`
              <tr @click=${() => this.onRowClick(row.original.symbol)}>
                ${row.getVisibleCells().map((cell) => this.renderCell(cell))}
              </tr>
            `,
          )}
        </tbody>
      </table>
    `
  }

  private renderCell(cell: Cell<HoldingsEntry, unknown>): TemplateResult {
    const id = cell.column.id
    const value = Number(cell.getValue())
    const isNumber = id !== 'symbol'
    const pnl = id === 'unrealizedPnlCents' || id === 'unrealizedPnlPct'
    const className = [
      isNumber ? 'num' : '',
      pnl ? (value >= 0 ? 'positive' : 'negative') : '',
    ]
      .filter((part) => part.length > 0)
      .join(' ')

    let text: string
    switch (id) {
      case 'symbol':
        text = String(cell.getValue())
        break
      case 'qty':
        text = fmtNumber(value)
        break
      case 'avgCostCents':
        text = fmtMoney(value)
        break
      case 'currentPrice':
        text = fmtPrice(value)
        break
      case 'marketValueCents':
        text = fmtMoney(value)
        break
      case 'unrealizedPnlCents':
        text = fmtMoneySigned(value)
        break
      case 'unrealizedPnlPct':
        text = fmtPct(value)
        break
      default:
        text = String(cell.getValue())
    }
    return html`<td class=${className}>${text}</td>`
  }
}

defineElement('sg-holdings-table', SgHoldingsTable)
