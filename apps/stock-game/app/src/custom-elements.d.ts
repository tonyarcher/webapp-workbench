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
        placeholder?: string
      }
      'sg-trade-form': ElementProps & {
        results?: SymbolSearchResult[]
        quote?: Quote | null
        cashCents?: number
        holdings?: HoldingsEntry[]
        busy?: boolean
        symbol?: string
      }
      'sg-settings-form': ElementProps & {
        config?: GameConfig | null
        busy?: boolean
      }
    }
  }
}
