import type { DetailedHTMLProps, HTMLAttributes } from 'react'
import type {
  GameConfig,
  HoldingsEntry,
  Order,
  Quote,
  SymbolSearchResult,
  Trade,
} from '@stock-game/shared'

type ElementProps = Omit<
  DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>,
  'results'
>

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'sg-portfolio-chart': ElementProps & {
        points?: Array<{ time: number; value: number }>
        gainPoints?: Array<{ time: number; value: number }>
      }
      'sg-holdings-table': ElementProps & {
        holdings?: HoldingsEntry[]
      }
      'sg-trades-table': ElementProps & {
        trades?: Trade[]
      }
      'sg-orders-table': ElementProps & {
        orders?: Order[]
        busy?: boolean
      }
      'sg-symbol-search': ElementProps & {
        results?: SymbolSearchResult[]
        value?: string
        query?: string
        placeholder?: string
        searching?: boolean
        error?: string | null
      }
      'sg-trade-form': ElementProps & {
        results?: SymbolSearchResult[]
        query?: string
        quote?: Quote | null
        cashCents?: number
        holdings?: HoldingsEntry[]
        busy?: boolean
        symbol?: string
        searching?: boolean
        searchError?: string | null
        quoteLoading?: boolean
        quoteError?: string | null
        commissionCents?: number
        quoteDelayMinutes?: number
      }
      'sg-settings-form': ElementProps & {
        config?: GameConfig | null
        busy?: boolean
      }
    }
  }
}
