export type AssetCategory = 'stock' | 'index' | 'commodity' | 'bond' | 'crypto' | 'fund' | 'player'

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
  kind: AssetCategory | 'macro'
  related_symbols: string[]
  source: string | null
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

export interface GameState {
  time_scale: number
  tick_seconds: number
  last_tick_at: string
  game_started_at: string
  trading_open: boolean
}

export interface Mission {
  id: string
  code: string
  title: string
  description: string
  reward: number
  kind: 'trade' | 'diversify' | 'profit' | 'crisis'
  target: number
  sort_order: number
  is_active: boolean
}

export interface PlayerMission {
  mission_id: string
  progress: number
  completed_at: string | null
  claimed_at: string | null
}

export interface LedgerEntry {
  id: number
  amount: number
  kind: 'transfer_in' | 'transfer_out' | 'mission_reward' | 'admin_grant' | 'match_reward'
  note: string | null
  created_at: string
}

export interface AdminPlayer {
  user_id: string
  username: string
  cash_balance: number
  invested: number
  equity: number
  role: 'player' | 'admin'
  created_at: string
}

export interface Scenario {
  id: string
  code: string
  title: string
  description: string
  is_active: boolean
  triggered_at: string | null
}

export interface PlayerStats {
  position: string
  position_group: 'GK' | 'DEF' | 'MID' | 'FWD'
  overall: number
  pace: number | null
  physical: number | null
  dribbling: number | null
  passing: number | null
  shooting: number | null
  defending: number | null
  gk_diving: number | null
  gk_handling: number | null
  gk_kicking: number | null
  gk_reflexes: number | null
  gk_speed: number | null
  gk_positioning: number | null
  club: string | null
  nationality: string | null
  age: number | null
  matches: number
  goals: number
  assists: number
  form: number
}

export interface PlayerAsset extends Asset {
  player_stats: PlayerStats | null
}

export interface CareerMatch {
  id: string
  opponent: string
  goals_for: number
  goals_against: number
  result: 'win' | 'draw' | 'loss'
  reward: number
  squad_rating: number | null
  played_at: string
}

export interface MatchResult {
  match_id: string
  opponent: string
  goals_for: number
  goals_against: number
  result: 'win' | 'draw' | 'loss'
  reward: number
  squad_size: number
  squad_rating: number
  events: Array<{ minute: number; type: string; player: string }>
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  stock: 'Hisse',
  index: 'Endeks',
  commodity: 'Emtia',
  bond: 'Tahvil',
  crypto: 'Kripto',
  fund: 'Fon',
  player: 'Oyuncu',
}

export const NEWS_KIND_LABELS: Record<NewsItem['kind'], string> = {
  macro: 'Makro',
  stock: 'Hisse',
  index: 'Endeks',
  commodity: 'Emtia',
  bond: 'Tahvil',
  crypto: 'Kripto',
  fund: 'Fon',
  player: 'Oyuncu',
}

export const LEDGER_LABELS: Record<LedgerEntry['kind'], string> = {
  transfer_in: 'Gelen transfer',
  transfer_out: 'Giden transfer',
  mission_reward: 'Görev ödülü',
  admin_grant: 'Admin işlemi',
  match_reward: 'Maç ödülü',
}
