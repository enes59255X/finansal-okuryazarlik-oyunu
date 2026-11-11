import { describe, expect, it } from 'vitest'
import {
  allocation,
  computePositionMetrics,
  dayChangeRatio,
  portfolioValue,
  round2,
  totalEquity,
} from './portfolio'
import type { Asset, Position } from './types'

function asset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'a1',
    symbol: 'THYAO',
    name: 'Türk Hava Yolları',
    category: 'stock',
    current_price: 300,
    previous_close: 250,
    volatility: 0.03,
    is_active: true,
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function position(overrides: Partial<Position> = {}): Position {
  return {
    asset_id: 'a1',
    shares: 10,
    average_buy_price: 250,
    assets: asset(),
    ...overrides,
  }
}

describe('computePositionMetrics', () => {
  it('kârı ve oranı doğru hesaplar', () => {
    const metrics = computePositionMetrics(position())
    expect(metrics).not.toBeNull()
    expect(metrics?.cost).toBe(2500)
    expect(metrics?.marketValue).toBe(3000)
    expect(metrics?.unrealizedPnl).toBe(500)
    expect(metrics?.unrealizedPnlRatio).toBeCloseTo(0.2)
  })

  it('varlık yoksa null döner', () => {
    expect(computePositionMetrics(position({ assets: null }))).toBeNull()
  })

  it('sıfır maliyette oranı 0 kabul eder', () => {
    const metrics = computePositionMetrics(position({ shares: 0, average_buy_price: 0 }))
    expect(metrics?.unrealizedPnlRatio).toBe(0)
  })
})

describe('portföy toplamları', () => {
  it('portföy değerini toplar', () => {
    expect(portfolioValue([position(), position({ asset_id: 'a2', shares: 2, assets: asset({ id: 'a2', current_price: 100 }) })])).toBe(3200)
  })

  it('toplam varlığı nakit ile birleştirir', () => {
    expect(totalEquity(1500.5, [position()])).toBe(4500.5)
  })

  it('dağılım oranlarını hesaplar', () => {
    const rows = allocation([
      { assetId: 'a1', symbol: 'A', name: 'A', shares: 1, averageBuyPrice: 1, currentPrice: 1, cost: 100, marketValue: 300, unrealizedPnl: 0, unrealizedPnlRatio: 0 },
      { assetId: 'a2', symbol: 'B', name: 'B', shares: 1, averageBuyPrice: 1, currentPrice: 1, cost: 100, marketValue: 100, unrealizedPnl: 0, unrealizedPnlRatio: 0 },
    ])
    expect(rows[0]?.ratio).toBeCloseTo(0.75)
    expect(rows[1]?.ratio).toBeCloseTo(0.25)
  })
})

describe('günlük değişim', () => {
  it('yüzde değişimi hesaplar', () => {
    expect(dayChangeRatio(asset())).toBeCloseTo(0.2)
  })

  it('önceki kapanış yoksa 0 döner', () => {
    expect(dayChangeRatio(asset({ previous_close: null }))).toBe(0)
  })
})

describe('round2', () => {
  it('kuruş hassasiyetinde yuvarlar', () => {
    expect(round2(10.005)).toBe(10.01)
    expect(round2(2.344)).toBe(2.34)
  })
})
