import { LitElement, css, html } from 'lit'
import {
  createChart,
  ColorType,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'
import { defineElement } from './define'

export interface PortfolioChartPoint {
  time: number
  value: number
}

export class SgPortfolioChart extends LitElement {
  static override styles = css`
    :host {
      display: block;
      width: 100%;
    }

    .chart {
      width: 100%;
      height: 320px;
    }
  `

  static override properties = {
    points: { attribute: false },
    gainPoints: { attribute: false },
  }

  points: PortfolioChartPoint[] = []
  gainPoints: PortfolioChartPoint[] = []

  private chart: IChartApi | undefined
  private series: ISeriesApi<'Line'> | undefined
  private gainSeries: ISeriesApi<'Line'> | undefined

  override firstUpdated(): void {
    const el = this.renderRoot.querySelector('.chart')
    if (!(el instanceof HTMLElement)) return
    this.chart = createChart(el, chartOptions())
    this.series = this.chart.addSeries(LineSeries, lineOptions('#4f9cf9'))
    this.gainSeries = this.chart.addSeries(LineSeries, { ...lineOptions('#3fb950'), priceScaleId: 'left' })
    this.updateSeries()
  }

  override updated(): void {
    this.updateSeries()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this.chart?.remove()
    this.chart = undefined
    this.series = undefined
    this.gainSeries = undefined
  }

  private gainColor(): string {
    const last = this.gainPoints.at(-1)
    if (last === undefined) return '#3fb950'
    return last.value >= 0 ? '#3fb950' : '#f85149'
  }

  private updateSeries(): void {
    if (!this.series) return
    this.series.setData(
      this.points.map((point) => ({
        time: Math.floor(point.time / 1000) as UTCTimestamp,
        value: point.value,
      })),
    )
    if (!this.gainSeries) return
    this.gainSeries.applyOptions({ color: this.gainColor() })
    this.gainSeries.setData(
      this.gainPoints.map((point) => ({
        time: Math.floor(point.time / 1000) as UTCTimestamp,
        value: point.value,
      })),
    )
  }

  override render() {
    return html`<div class="chart"></div>`
  }
}

function chartOptions() {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#9aa4b2',
      attributionLogo: false,
    },
    grid: { vertLines: { color: '#1f2430' }, horzLines: { color: '#1f2430' } },
    rightPriceScale: { borderVisible: false },
    leftPriceScale: { visible: true, borderVisible: false },
    timeScale: { borderVisible: false },
  }
}

function lineOptions(color: string) {
  return { color, lineWidth: 2 as const, priceFormat: { type: 'price' as const, precision: 2, minMove: 0.01 } }
}

defineElement('sg-portfolio-chart', SgPortfolioChart)
