export type AssetCategory = 'stock' | 'index' | 'commodity' | 'bond' | 'crypto'

export interface Asset {
  id: string
  symbol: string
  name: string
  category: AssetCategory
  current_price: number
  previous_close: number | null
  volatility: number
  is_active: boolean
  updated_at: string
}

export interface Profile {
  id: string
  username: string
  cash_balance: number
  role: 'player' | 'admin'
  created_at: string
}

export interface Position {
  asset_id: string
  shares: number
  average_buy_price: number
  assets: Asset | null
}

export interface TransactionRow {
  id: string
  asset_id: string
  side: 'buy' | 'sell'
  shares: number
  price: number
  total: number
  realized_pnl: number | null
  created_at: string
  assets: Pick<Asset, 'symbol' | 'name'> | null
}

export interface NewsItem {
  id: string
  headline: string
  body: string | null
  severity: 'info' | 'warning' | 'critical'
  published_at: string
}

export interface PricePoint {
  price: number
  recorded_at: string
}

export interface LeaderboardRow {
  rank: number
  user_id: string
  username: string
  cash_balance: number
  invested: number
  equity: number
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  stock: 'Hisse',
  index: 'Endeks',
  commodity: 'Emtia',
  bond: 'Tahvil',
  crypto: 'Kripto',
}
