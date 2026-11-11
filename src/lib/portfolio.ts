import type { Asset, Position } from './types'

export interface PositionMetrics {
  assetId: string
  symbol: string
  name: string
  shares: number
  averageBuyPrice: number
  currentPrice: number
  cost: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlRatio: number
}

export function computePositionMetrics(position: Position): PositionMetrics | null {
  const asset = position.assets
  if (!asset) return null

  const shares = Number(position.shares)
  const averageBuyPrice = Number(position.average_buy_price)
  const currentPrice = Number(asset.current_price)
  const cost = round2(shares * averageBuyPrice)
  const marketValue = round2(shares * currentPrice)
  const unrealizedPnl = round2(marketValue - cost)

  return {
    assetId: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    shares,
    averageBuyPrice,
    currentPrice,
    cost,
    marketValue,
    unrealizedPnl,
    unrealizedPnlRatio: cost > 0 ? unrealizedPnl / cost : 0,
  }
}

export function portfolioValue(positions: Position[]): number {
  return round2(
    positions.reduce((total, position) => total + Number(position.shares) * Number(position.assets?.current_price ?? 0), 0),
  )
}

export function totalEquity(cashBalance: number, positions: Position[]): number {
  return round2(Number(cashBalance) + portfolioValue(positions))
}

export function dayChangeRatio(asset: Pick<Asset, 'current_price' | 'previous_close'>): number {
  const previous = Number(asset.previous_close ?? 0)
  if (previous <= 0) return 0
  return (Number(asset.current_price) - previous) / previous
}

export function allocation(metrics: PositionMetrics[]): Array<{ symbol: string; value: number; ratio: number }> {
  const total = metrics.reduce((sum, item) => sum + item.marketValue, 0)
  return metrics.map((item) => ({
    symbol: item.symbol,
    value: item.marketValue,
    ratio: total > 0 ? item.marketValue / total : 0,
  }))
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}
