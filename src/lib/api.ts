import { supabase } from './supabase'
import type {
  AdminPlayer,
  Asset,
  CareerMatch,
  GameState,
  LedgerEntry,
  LeaderboardRow,
  MatchResult,
  Mission,
  NewsItem,
  PlayerAsset,
  PlayerMission,
  Position,
  PricePoint,
  Scenario,
  TransactionRow,
} from './types'

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

export async function fetchPriceHistoryBySymbol(symbol: string, limit = 40): Promise<PricePoint[]> {
  const { data: asset } = await supabase.from('assets').select('id').eq('symbol', symbol).maybeSingle()
  if (!asset) return []
  return fetchPriceHistory((asset as { id: string }).id, limit)
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

export async function fetchNews(limit = 10): Promise<NewsItem[]> {
  const { data, error } = await supabase
    .from('news')
    .select('id, headline, body, severity, kind, related_symbols, source, published_at')
    .order('published_at', { ascending: false })
    .limit(limit)

  return unwrap(data as NewsItem[] | null, error)
}

export async function fetchLeaderboard(limit = 25): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_leaderboard', { p_limit: limit })
  return unwrap(data as LeaderboardRow[] | null, error)
}

export async function placeOrder(side: 'buy' | 'sell', assetId: string, shares: number): Promise<void> {
  const { error } = await supabase.rpc(side === 'buy' ? 'buy_asset' : 'sell_asset', {
    p_asset_id: assetId,
    p_shares: shares,
  })

  if (error) throw new Error(error.message)
}

export async function fetchGameState(): Promise<GameState> {
  const { data, error } = await supabase
    .from('game_state')
    .select('time_scale, tick_seconds, last_tick_at, game_started_at, trading_open')
    .single()

  return unwrap(data as GameState | null, error)
}

export async function tickMarket(): Promise<number> {
  const { data, error } = await supabase.rpc('tick_market', { p_force: false })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

export async function fetchMissions(): Promise<Array<Mission & PlayerMission>> {
  const { data, error } = await supabase
    .from('missions')
    .select(
      'id, code, title, description, reward, kind, target, sort_order, is_active, player_missions (mission_id, progress, completed_at, claimed_at)',
    )
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const mission = row as unknown as Mission & {
      player_missions: PlayerMission[] | PlayerMission | null
    }
    const raw = mission.player_missions
    const own = Array.isArray(raw) ? raw[0] : raw
    return {
      ...mission,
      mission_id: mission.id,
      progress: Number(own?.progress ?? 0),
      completed_at: own?.completed_at ?? null,
      claimed_at: own?.claimed_at ?? null,
    }
  })
}

export async function evaluateMissions(): Promise<string[]> {
  const { data, error } = await supabase.rpc('evaluate_missions')
  if (error) throw new Error(error.message)
  return (data as string[] | null) ?? []
}

export async function transferCash(to: string, amount: number, note?: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_cash', {
    p_to_username: to,
    p_amount: amount,
    p_note: note ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function fetchLedger(limit = 20): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('ledger')
    .select('id, amount, kind, note, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  return unwrap(data as LedgerEntry[] | null, error)
}

export async function fetchScenarios(): Promise<Scenario[]> {  const { data, error } = await supabase
    .from('scenarios')
    .select('id, code, title, description, is_active, triggered_at')
    .eq('is_active', true)
    .order('title')

  return unwrap(data as Scenario[] | null, error)
}

// --- futbol ----------------------------------------------------------------

export async function fetchPlayers(): Promise<PlayerAsset[]> {
  const { data, error } = await supabase
    .from('assets')
    .select(
      'id, symbol, name, category, current_price, previous_close, volatility, is_active, updated_at, player_stats (position, position_group, overall, pace, physical, dribbling, passing, shooting, defending, gk_diving, gk_handling, gk_kicking, gk_reflexes, gk_speed, gk_positioning, club, nationality, age, matches, goals, assists, form)',
    )
    .eq('category', 'player')
    .eq('is_active', true)
    .order('name')

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const player = row as unknown as PlayerAsset & { player_stats: PlayerAsset['player_stats'] | PlayerAsset['player_stats'][] }
    const stats = Array.isArray(player.player_stats) ? (player.player_stats[0] ?? null) : player.player_stats
    return { ...player, player_stats: stats }
  })
}

export async function playMatch(): Promise<MatchResult> {
  const { data, error } = await supabase.rpc('play_match')
  if (error) throw new Error(error.message)
  return data as MatchResult
}

export async function fetchCareerMatches(limit = 8): Promise<CareerMatch[]> {
  const { data, error } = await supabase
    .from('career_matches')
    .select('id, opponent, goals_for, goals_against, result, reward, squad_rating, played_at')
    .order('played_at', { ascending: false })
    .limit(limit)

  return unwrap(data as CareerMatch[] | null, error)
}

// --- admin -----------------------------------------------------------------

export async function adminSetTimeScale(scale: number): Promise<void> {
  const { error } = await supabase.rpc('admin_set_time_scale', { p_scale: scale })
  if (error) throw new Error(error.message)
}

export async function adminTickNow(): Promise<number> {
  const { data, error } = await supabase.rpc('admin_tick_now')
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

export async function adminSetPrice(symbol: string, price: number): Promise<void> {
  const { error } = await supabase.rpc('admin_set_price', { p_symbol: symbol, p_price: price })
  if (error) throw new Error(error.message)
}

export async function adminPublishNews(input: {
  headline: string
  body?: string
  severity: 'info' | 'warning' | 'critical'
  kind: NewsItem['kind']
  symbols: string[]
  source?: string
}): Promise<void> {
  const { error } = await supabase.rpc('admin_publish_news', {
    p_headline: input.headline,
    p_body: input.body ?? null,
    p_severity: input.severity,
    p_kind: input.kind,
    p_symbols: input.symbols,
    p_source: input.source ?? 'Piyasa Akademi',
  })
  if (error) throw new Error(error.message)
}

export async function adminTriggerScenario(code: string): Promise<void> {
  const { error } = await supabase.rpc('admin_trigger_scenario', { p_code: code })
  if (error) throw new Error(error.message)
}

export async function adminGrantCash(username: string, amount: number, note?: string): Promise<void> {
  const { error } = await supabase.rpc('admin_grant_cash', {
    p_username: username,
    p_amount: amount,
    p_note: note ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function adminResetPlayer(username: string): Promise<void> {
  const { error } = await supabase.rpc('admin_reset_player', { p_username: username })
  if (error) throw new Error(error.message)
}

export async function adminPlayers(): Promise<AdminPlayer[]> {
  const { data, error } = await supabase.rpc('admin_players')
  return unwrap(data as AdminPlayer[] | null, error)
}
