import { LitElement, html } from 'lit'
import type { PropertyValues, TemplateResult } from 'lit'
import {
  createColumnHelper,
  createTable,
  getCoreRowModel,
  getSortedRowModel,
} from '@tanstack/table-core'
import type { Cell, Header, HeaderGroup, Row, Table, TableState } from '@tanstack/table-core'
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

function formatCellValue(id: string, value: unknown): string {
  const num = Number(value)
  if (id === 'symbol') return String(value)
  if (id === 'qty') return fmtNumber(num)
  if (id === 'avgCostCents') return fmtMoney(num)
  if (id === 'currentPrice') return fmtPrice(num)
  if (id === 'marketValueCents') return fmtMoney(num)
  if (id === 'unrealizedPnlCents') return fmtMoneySigned(num)
  if (id === 'unrealizedPnlPct') return fmtPct(num)
  return String(value)
}

function cellClassName(id: string, value: number): string {
  const parts: string[] = []
  if (id !== 'symbol') parts.push('num')
  if (id === 'unrealizedPnlCents' || id === 'unrealizedPnlPct') {
    parts.push(value >= 0 ? 'positive' : 'negative')
  }
  return parts.join(' ')
}

export class SgHoldingsTable extends LitElement {
  static override styles = tableStyles

  static override properties = {
    holdings: { attribute: false },
  }

  holdings: HoldingsEntry[] = []

  private table: Table<HoldingsEntry>
  private state: TableState

  constructor() {
    super()
    this.table = createTable<HoldingsEntry>({
      data: [],
      columns,
      state: {},
      initialState: { sorting: [] },
      onStateChange: (updater) => {
        this.state = typeof updater === 'function' ? updater(this.state) : updater
        this.table.setOptions((prev) => ({ ...prev, state: this.state }))
        this.requestUpdate()
      },
      getCoreRowModel: getCoreRowModel(),
      getSortedRowModel: getSortedRowModel(),
      getRowId: (row) => row.symbol,
      renderFallbackValue: '',
    })
    this.state = this.table.initialState
    this.table.setOptions((prev) => ({ ...prev, state: this.state }))
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

  private renderHeaderCell(header: Header<HoldingsEntry, unknown>): TemplateResult {
    const sorted = header.column.getIsSorted()
    const label = HEADER_LABELS[header.column.id] ?? header.column.id
    const indicator = sorted === 'asc' ? ' ▲' : sorted === 'desc' ? ' ▼' : ''
    const cls = header.column.id === 'symbol' ? '' : 'num'
    return html`<th class=${cls} @click=${() => header.column.toggleSorting()}>
      ${label}${indicator}
    </th>`
  }

  private renderHeaderGroup(group: HeaderGroup<HoldingsEntry>): TemplateResult {
    return html`<tr>
      ${group.headers.map((header) => this.renderHeaderCell(header))}
    </tr>`
  }

  private renderRow(row: Row<HoldingsEntry>): TemplateResult {
    return html`<tr @click=${() => this.onRowClick(row.original.symbol)}>
      ${row.getVisibleCells().map((cell) => this.renderCell(cell))}
    </tr>`
  }

  override render(): TemplateResult {
    const rows = this.table.getRowModel().rows
    const groups = this.table.getHeaderGroups()
    return html`
      <table class="sg-table">
        <thead>
          ${groups.map((group) => this.renderHeaderGroup(group))}
        </thead>
        <tbody>
          ${rows.map((row) => this.renderRow(row))}
        </tbody>
      </table>
    `
  }

  private renderCell(cell: Cell<HoldingsEntry, unknown>): TemplateResult {
    const id = cell.column.id
    const value = Number(cell.getValue())
    const className = cellClassName(id, value)
    const text = formatCellValue(id, cell.getValue())
    return html`<td class=${className}>${text}</td>`
  }
}

defineElement('sg-holdings-table', SgHoldingsTable)
