const tryFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactFormatter = new Intl.NumberFormat('tr-TR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const qtyFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
})

export function formatTRY(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return tryFormatter.format(value)
}

export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return compactFormatter.format(value)
}

export function formatQty(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return qtyFormatter.format(value)
}

export function formatPercent(ratio: number, withSign = true): string {
  if (!Number.isFinite(ratio)) return '—'
  const pct = ratio * 100
  const sign = withSign && pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(2).replace('.', ',')}%`
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
}
