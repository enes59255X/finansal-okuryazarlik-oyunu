import { supabase } from './supabase'
import type { Asset, LeaderboardRow, NewsItem, Position, PricePoint, TransactionRow } from './types'

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error('Kayıt bulunamadı.')
  return data
}

export async function fetchAssets(): Promise<Asset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('id, symbol, name, category, current_price, previous_close, volatility, is_active, updated_at')
    .eq('is_active', true)
    .order('category')
    .order('symbol')

  return unwrap(data as Asset[] | null, error)
}

export async function fetchAsset(assetId: string): Promise<Asset> {
  const { data, error } = await supabase
    .from('assets')
    .select('id, symbol, name, category, current_price, previous_close, volatility, is_active, updated_at')
    .eq('id', assetId)
    .single()

  return unwrap(data as Asset | null, error)
}

export async function fetchPriceHistory(assetId: string, limit = 120): Promise<PricePoint[]> {
  const { data, error } = await supabase
    .from('price_history')
    .select('price, recorded_at')
    .eq('asset_id', assetId)
    .order('recorded_at', { ascending: false })
    .limit(limit)

  const rows = unwrap(data as PricePoint[] | null, error)
  return rows.reverse()
}

export async function fetchPositions(userId: string): Promise<Position[]> {
  const { data, error } = await supabase
    .from('portfolios')
    .select(
      'asset_id, shares, average_buy_price, assets (id, symbol, name, category, current_price, previous_close, volatility, is_active, updated_at)',
    )
    .eq('user_id', userId)

  return unwrap(data as unknown as Position[] | null, error)
}

export async function fetchTransactions(userId: string, limit = 25): Promise<TransactionRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, asset_id, side, shares, price, total, realized_pnl, created_at, assets (symbol, name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return unwrap(data as unknown as TransactionRow[] | null, error)
}

export async function fetchNews(limit = 8): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from('news')
    .select('id, headline, body, severity, published_at')
    .order('published_at', { ascending: false })
    .limit(limit)

  return unwrap(data as NewsItem[] | null, error)
}

export async function fetchLeaderboard(limit = 25): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: limit })
  return unwrap(data as LeaderboardRow[] | null, error)
}

export async function placeOrder(
  side: 'buy' | 'sell',
  assetId: string,
  shares: number,
): Promise<void> {
  const { error } = await supabase.rpc(side === 'buy' ? 'buy_asset' : 'sell_asset', {
    p_asset_id: assetId,
    p_shares: shares,
  })

  if (error) throw new Error(error.message)
}
