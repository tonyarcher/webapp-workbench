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
  }

  points: PortfolioChartPoint[] = []

  private chart: IChartApi | undefined
  private series: ISeriesApi<'Line'> | undefined

  override firstUpdated(): void {
    const el = this.renderRoot.querySelector('.chart')
    if (!(el instanceof HTMLElement)) return
    this.chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9aa4b2',
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: '#1f2430' },
        horzLines: { color: '#1f2430' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    })
    this.series = this.chart.addSeries(LineSeries, {
      color: '#4f9cf9',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    })
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
  }

  private updateSeries(): void {
    if (!this.series) return
    this.series.setData(
      this.points.map((point) => ({
        time: Math.floor(point.time / 1000) as UTCTimestamp,
        value: point.value,
      })),
    )
  }

  override render() {
    return html`<div class="chart"></div>`
  }
}

defineElement('sg-portfolio-chart', SgPortfolioChart)
