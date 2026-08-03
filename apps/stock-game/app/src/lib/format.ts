export function fmtMoney(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function fmtMoneySigned(cents: number): string {
  const sign = cents > 0 ? '+' : cents < 0 ? '-' : ''
  return `${sign}${fmtMoney(Math.abs(cents))}`
}

export function fmtPrice(price: number): string {
  return `$${price.toFixed(2)}`
}

export function fmtPct(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function fmtNumber(value: number): string {
  return value.toLocaleString('en-US')
}

export function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function fmtDateTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
