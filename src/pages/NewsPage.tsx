import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { Sparkline } from '../components/Sparkline'
import { fetchNews, fetchPriceHistoryBySymbol } from '../lib/api'
import { formatDate, formatPercent } from '../lib/format'
import { NEWS_KIND_LABELS, type NewsItem, type PricePoint } from '../lib/types'

const KIND_FILTERS: Array<{ value: NewsItem['kind'] | 'all'; label: string }> = [
  { value: 'all', label: 'Tümü' },
  { value: 'stock', label: 'Hisse' },
  { value: 'fund', label: 'Fon' },
  { value: 'crypto', label: 'Kripto' },
  { value: 'commodity', label: 'Emtia' },
  { value: 'bond', label: 'Tahvil' },
  { value: 'macro', label: 'Makro' },
]

export function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [history, setHistory] = useState<Record<string, PricePoint[]>>({})
  const [kind, setKind] = useState<NewsItem['kind'] | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetchNews(24)
      .then(async (items) => {
        if (!active) return
        setNews(items)

        const symbols = [
          ...new Set(items.map((item) => item.related_symbols[0]).filter((symbol): symbol is string => Boolean(symbol))),
        ]
        const entries = await Promise.all(
          symbols.map(async (symbol) => [symbol, await fetchPriceHistoryBySymbol(symbol, 40)] as const),
        )
        if (active) setHistory(Object.fromEntries(entries))
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Haberler yüklenemedi.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const filtered = useMemo(
    () => (kind === 'all' ? news : news.filter((item) => item.kind === kind)),
    [news, kind],
  )

  const hero = filtered[0]
  const rest = filtered.slice(1)

  return (
    <PageShell title="Haberler" subtitle="Piyasa etkisi olan gelişmeler, grafiklerle birlikte.">
      <div className="mb-5 flex flex-wrap gap-1">
        {KIND_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setKind(filter.value)}
            className={[
              'rounded-lg px-3 py-1.5 text-xs font-medium transition',
              kind === filter.value
                ? 'bg-emerald-500/15 text-emerald-300'
                : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200',
            ].join(' ')}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="h-44 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-900/30" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-slate-800/70 bg-slate-900/30 p-8 text-center text-sm text-slate-500">
          Bu kategoride haber yok.
        </p>
      ) : (
        <>
          {hero ? <HeroCard item={hero} points={history[hero.related_symbols[0] ?? ''] ?? []} /> : null}

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {rest.map((item) => (
              <NewsCard key={item.id} item={item} points={history[item.related_symbols[0] ?? ''] ?? []} />
            ))}
          </div>
        </>
      )}
    </PageShell>
  )
}

function HeroCard({ item, points }: { item: NewsItem; points: PricePoint[] }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-800/70 bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-slate-900/20 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={item.severity} />
            <Tag>{NEWS_KIND_LABELS[item.kind]}</Tag>
            <span className="text-[11px] text-slate-500">
              {item.source ?? 'Piyasa Akademi'} · {formatDate(item.published_at)}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-snug text-white sm:text-2xl">{item.headline}</h2>
          {item.body ? <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p> : null}
          {item.related_symbols.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {item.related_symbols.map((symbol) => (
                <SymbolChip key={symbol} symbol={symbol} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
          <Sparkline values={points.map((point) => Number(point.price))} width={180} height={56} />
          <ChangeBadge points={points} />
        </div>
      </div>
    </article>
  )
}

function NewsCard({ item, points }: { item: NewsItem; points: PricePoint[] }) {
  return (
    <article className="flex flex-col justify-between rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5 transition hover:border-slate-700">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={item.severity} />
          <Tag>{NEWS_KIND_LABELS[item.kind]}</Tag>
          <span className="text-[11px] text-slate-500">{formatDate(item.published_at)}</span>
        </div>
        <h3 className="mt-2.5 text-base font-semibold leading-snug text-white">{item.headline}</h3>
        {item.body ? <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-400">{item.body}</p> : null}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {item.related_symbols.slice(0, 3).map((symbol) => (
            <SymbolChip key={symbol} symbol={symbol} />
          ))}
        </div>
        <div className="text-right">
          <Sparkline values={points.map((point) => Number(point.price))} width={110} height={30} />
          <ChangeBadge points={points} />
        </div>
      </div>
    </article>
  )
}

function ChangeBadge({ points }: { points: PricePoint[] }) {
  if (points.length < 2) return null
  const first = Number(points[0]!.price)
  const last = Number(points[points.length - 1]!.price)
  const ratio = first > 0 ? (last - first) / first : 0
  const positive = ratio >= 0
  return (
    <span className={`tabular-nums text-[11px] font-medium ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>
      {formatPercent(ratio)} · 40 kayıt
    </span>
  )
}

function SymbolChip({ symbol }: { symbol: string }) {
  return (
    <Link
      to="/"
      className="rounded-md border border-slate-700/70 bg-slate-800/40 px-2 py-0.5 text-[11px] font-medium text-slate-300 transition hover:border-emerald-500/40 hover:text-emerald-300"
    >
      {symbol}
    </Link>
  )
}

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded-md bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-300">
      {children}
    </span>
  )
}

function SeverityBadge({ severity }: { severity: NewsItem['severity'] }) {
  const styles =
    severity === 'critical'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      : severity === 'warning'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
        : 'border-sky-500/30 bg-sky-500/10 text-sky-300'

  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${styles}`}>
      {severity === 'critical' ? 'Kritik' : severity === 'warning' ? 'Uyarı' : 'Bilgi'}
    </span>
  )
}
