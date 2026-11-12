import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { PageShell } from '../components/PageShell'
import { TransferCard } from '../components/TransferCard'
import { fetchPositions, fetchTransactions } from '../lib/api'
import { formatDate, formatPercent, formatQty, formatTRY } from '../lib/format'
import { allocation, computePositionMetrics, portfolioValue, totalEquity } from '../lib/portfolio'
import type { Position, TransactionRow } from '../lib/types'

export function PortfolioPage() {
  const { profile } = useAuth()
  const [positions, setPositions] = useState<Position[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profile) return
    setError(null)
    try {
      const [nextPositions, nextTransactions] = await Promise.all([
        fetchPositions(profile.id),
        fetchTransactions(profile.id),
      ])
      setPositions(nextPositions)
      setTransactions(nextTransactions)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Portföy yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    void load()
  }, [load])

  const metrics = useMemo(
    () => positions.map(computePositionMetrics).filter((item): item is NonNullable<typeof item> => item !== null),
    [positions],
  )

  const cash = Number(profile?.cash_balance ?? 0)
  const invested = portfolioValue(positions)
  const equity = totalEquity(cash, positions)
  const totalCost = metrics.reduce((sum, item) => sum + item.cost, 0)
  const totalPnl = metrics.reduce((sum, item) => sum + item.unrealizedPnl, 0)
  const slices = allocation(metrics).sort((a, b) => b.ratio - a.ratio)

  return (
    <PageShell title="Portföy" subtitle="Pozisyonların, kâr-zarar durumun ve işlem geçmişin.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Nakit" value={formatTRY(cash)} />
        <Card label="Yatırımdaki değer" value={formatTRY(invested)} />
        <Card label="Toplam varlık" value={formatTRY(equity)} />
        <Card
          label="Açık kâr / zarar"
          value={formatTRY(totalPnl)}
          hint={totalCost > 0 ? formatPercent(totalPnl / totalCost) : undefined}
          tone={totalPnl >= 0 ? 'up' : 'down'}
        />
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40">
          <h2 className="border-b border-slate-800/70 px-5 py-3.5 text-sm font-semibold text-white">
            Pozisyonlar
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Varlık</th>
                  <th className="px-4 py-2.5 text-right font-medium">Adet</th>
                  <th className="px-4 py-2.5 text-right font-medium">Maliyet</th>
                  <th className="px-4 py-2.5 text-right font-medium">Değer</th>
                  <th className="px-4 py-2.5 text-right font-medium">Kâr / zarar</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      Yükleniyor…
                    </td>
                  </tr>
                ) : metrics.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      Henüz pozisyonun yok.{' '}
                      <Link to="/" className="text-emerald-400 hover:underline">
                        Piyasaya göz at
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  metrics.map((item) => (
                    <tr
                      key={item.assetId}
                      className="border-b border-slate-800/40 transition last:border-0 hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-3">
                        <Link to={`/asset/${item.assetId}`} className="block">
                          <span className="block font-medium text-white">{item.symbol}</span>
                          <span className="block text-[11px] text-slate-500">{item.name}</span>
                        </Link>
                      </td>
                      <td className="tabular-nums px-4 py-3 text-right text-slate-300">{formatQty(item.shares)}</td>
                      <td className="tabular-nums px-4 py-3 text-right text-slate-400">
                        {formatTRY(item.averageBuyPrice)}
                      </td>
                      <td className="tabular-nums px-4 py-3 text-right font-medium text-slate-100">
                        {formatTRY(item.marketValue)}
                      </td>
                      <td
                        className={[
                          'tabular-nums px-4 py-3 text-right font-medium',
                          item.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400',
                        ].join(' ')}
                      >
                        {formatTRY(item.unrealizedPnl)}
                        <span className="block text-[10px] text-slate-500">
                          {formatPercent(item.unrealizedPnlRatio)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-white">Dağılım</h2>
            {slices.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Dağılım için önce pozisyon aç.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {slices.map((slice) => (
                  <li key={slice.symbol}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{slice.symbol}</span>
                      <span className="tabular-nums text-slate-400">{formatPercent(slice.ratio, false)}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${slice.ratio * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-white">Son işlemler</h2>
            <ul className="mt-3 space-y-3">
              {transactions.length === 0 ? (
                <li className="text-xs text-slate-500">Henüz işlem yok.</li>
              ) : (
                transactions.map((transaction) => (
                  <li key={transaction.id} className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-200">
                        <span
                          className={transaction.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'}
                        >
                          {transaction.side === 'buy' ? 'AL' : 'SAT'}
                        </span>{' '}
                        {transaction.assets?.symbol ?? '—'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {formatQty(Number(transaction.shares))} adet · {formatDate(transaction.created_at)}
                      </p>
                    </div>
                    <p className="tabular-nums text-xs text-slate-300">{formatTRY(Number(transaction.total))}</p>
                  </li>
                ))
              )}
            </ul>
          </section>

          <TransferCard />
        </aside>
      </div>
    </PageShell>
  )
}

function Card({ label, value, hint, tone }: {
  label: string
  value: string
  hint?: string
  tone?: 'up' | 'down'
}) {
  const color = tone === 'up' ? 'text-emerald-300' : tone === 'down' ? 'text-rose-300' : 'text-slate-100'
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`tabular-nums mt-1.5 text-lg font-semibold ${color}`}>{value}</p>
      {hint ? <p className="tabular-nums mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  )
}
