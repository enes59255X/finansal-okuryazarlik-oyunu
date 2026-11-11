import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PageShell } from '../components/PageShell'
import { fetchAssets, fetchNews, fetchPositions } from '../lib/api'
import { formatDate, formatPercent, formatQty, formatTRY } from '../lib/format'
import { dayChangeRatio, portfolioValue, totalEquity } from '../lib/portfolio'
import { CATEGORY_LABELS, type Asset, type AssetCategory, type NewsItem, type Position } from '../lib/types'

const CATEGORY_FILTERS: Array<{ value: AssetCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'stock', label: 'Hisse' },
  { value: 'index', label: 'Endeks' },
  { value: 'commodity', label: 'Emtia' },
  { value: 'bond', label: 'Tahvil' },
  { value: 'crypto', label: 'Kripto' },
]

export function MarketPage() {
  const { profile } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<AssetCategory | 'all'>('all')
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    if (!profile) return
    setError(null)
    try {
      const [nextAssets, nextPositions, nextNews] = await Promise.all([
        fetchAssets(),
        fetchPositions(profile.id),
        fetchNews(6),
      ])
      setAssets(nextAssets)
      setPositions(nextPositions)
      setNews(nextNews)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Veriler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    void load()
  }, [load])

  const shareByAsset = useMemo(() => {
    const map = new Map<string, number>()
    for (const position of positions) map.set(position.asset_id, Number(position.shares))
    return map
  }, [positions])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return assets.filter((asset) => {
      const matchesCategory = category === 'all' || asset.category === category
      const matchesQuery =
        needle.length === 0 ||
        asset.symbol.toLowerCase().includes(needle) ||
        asset.name.toLowerCase().includes(needle)
      return matchesCategory && matchesQuery
    })
  }, [assets, category, query])

  const movers = useMemo(
    () =>
      [...assets]
        .sort((a, b) => Math.abs(dayChangeRatio(b)) - Math.abs(dayChangeRatio(a)))
        .slice(0, 3),
    [assets],
  )

  const cash = Number(profile?.cash_balance ?? 0)
  const holdings = portfolioValue(positions)
  const equity = totalEquity(cash, positions)
  const pnl = equity - 10000

  return (
    <PageShell
      title="Piyasa"
      subtitle="Sanal borsa açık. Alım-satım yapmak için bir varlık seç."
      actions={
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Piyasa açık
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Nakit" value={formatTRY(cash)} />
        <Kpi label="Portföy değeri" value={formatTRY(holdings)} />
        <Kpi label="Toplam varlık" value={formatTRY(equity)} accent />
        <Kpi
          label="Toplam kâr / zarar"
          value={formatTRY(pnl)}
          tone={pnl >= 0 ? 'up' : 'down'}
          hint={formatPercent(pnl / 10000)}
        />
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
          <button type="button" onClick={() => void load()} className="ml-3 underline">
            Tekrar dene
          </button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40">
          <div className="flex flex-col gap-3 border-b border-slate-800/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1">
              {CATEGORY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setCategory(filter.value)}
                  className={[
                    'rounded-lg px-2.5 py-1 text-xs font-medium transition',
                    category === filter.value
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
                  ].join(' ')}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Sembol veya isim ara"
              className="input sm:max-w-48"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Varlık</th>
                  <th className="px-4 py-2.5 font-medium">Kategori</th>
                  <th className="px-4 py-2.5 text-right font-medium">Fiyat</th>
                  <th className="px-4 py-2.5 text-right font-medium">Günlük</th>
                  <th className="px-4 py-2.5 text-right font-medium">Pozisyon</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                      Piyasa verisi yükleniyor…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                      Aramanla eşleşen varlık yok.
                    </td>
                  </tr>
                ) : (
                  filtered.map((asset) => {
                    const ratio = dayChangeRatio(asset)
                    const owned = shareByAsset.get(asset.id) ?? 0
                    return (
                      <tr
                        key={asset.id}
                        className="border-b border-slate-800/40 transition last:border-0 hover:bg-slate-800/30"
                      >
                        <td className="px-4 py-3">
                          <Link to={`/asset/${asset.id}`} className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-800/80 text-[10px] font-bold text-slate-300">
                              {asset.symbol.slice(0, 4)}
                            </span>
                            <span>
                              <span className="block font-medium text-white">{asset.name}</span>
                              <span className="block text-[11px] text-slate-500">{asset.symbol}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">{CATEGORY_LABELS[asset.category]}</td>
                        <td className="tabular-nums px-4 py-3 text-right font-medium text-slate-100">
                          {formatTRY(Number(asset.current_price))}
                        </td>
                        <td
                          className={[
                            'tabular-nums px-4 py-3 text-right font-medium',
                            ratio > 0 ? 'text-emerald-400' : ratio < 0 ? 'text-rose-400' : 'text-slate-400',
                          ].join(' ')}
                        >
                          {formatPercent(ratio)}
                        </td>
                        <td className="tabular-nums px-4 py-3 text-right text-xs text-slate-400">
                          {owned > 0 ? formatQty(owned) : '—'}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-white">En hareketli</h2>
            <ul className="mt-3 space-y-3">
              {movers.map((asset) => {
                const ratio = dayChangeRatio(asset)
                return (
                  <li key={asset.id}>
                    <Link to={`/asset/${asset.id}`} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-300">{asset.symbol}</span>
                      <span
                        className={[
                          'tabular-nums text-sm font-medium',
                          ratio >= 0 ? 'text-emerald-400' : 'text-rose-400',
                        ].join(' ')}
                      >
                        {formatPercent(ratio)}
                      </span>
                    </Link>
                  </li>
                )
              })}
              {movers.length === 0 ? <li className="text-xs text-slate-500">Veri yok.</li> : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-white">Haber akışı</h2>
            <ul className="mt-3 space-y-4">
              {news.map((item) => (
                <li key={item.id} className="border-l-2 border-slate-700 pl-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'text-[10px] uppercase tracking-[0.14em]',
                        item.severity === 'critical'
                          ? 'text-rose-400'
                          : item.severity === 'warning'
                            ? 'text-amber-400'
                            : 'text-sky-400',
                      ].join(' ')}
                    >
                      {item.severity === 'critical' ? 'Kritik' : item.severity === 'warning' ? 'Uyarı' : 'Bilgi'}
                    </span>
                    <span className="text-[10px] text-slate-600">{formatDate(item.published_at)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-200">{item.headline}</p>
                  {item.body ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.body}</p> : null}
                </li>
              ))}
              {news.length === 0 ? <li className="text-xs text-slate-500">Henüz haber yok.</li> : null}
            </ul>
          </section>
        </aside>
      </div>
    </PageShell>
  )
}

function Kpi({
  label,
  value,
  hint,
  accent = false,
  tone,
}: {
  label: string
  value: string
  hint?: string
  accent?: boolean
  tone?: 'up' | 'down'
}) {
  const valueColor =
    tone === 'up' ? 'text-emerald-300' : tone === 'down' ? 'text-rose-300' : accent ? 'text-white' : 'text-slate-100'

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`tabular-nums mt-1.5 text-lg font-semibold ${valueColor}`}>{value}</p>
      {hint ? <p className="tabular-nums mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  )
}
