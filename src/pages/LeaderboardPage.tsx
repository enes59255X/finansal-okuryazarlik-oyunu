import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { PageShell } from '../components/PageShell'
import { fetchLeaderboard } from '../lib/api'
import { formatPercent, formatTRY } from '../lib/format'
import type { LeaderboardRow } from '../lib/types'

export function LeaderboardPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    fetchLeaderboard(50)
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Sıralama yüklenemedi.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return (
    <PageShell title="Liderlik" subtitle="Toplam varlığa göre sıralama. Sezon: aktif.">
      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Oyuncu</th>
              <th className="px-4 py-3 text-right font-medium">Nakit</th>
              <th className="px-4 py-3 text-right font-medium">Yatırım</th>
              <th className="px-4 py-3 text-right font-medium">Toplam varlık</th>
              <th className="px-4 py-3 text-right font-medium">Getiri</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  Sıralama yükleniyor…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  Henüz sıralanmış oyuncu yok.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isMe = row.user_id === profile?.id
                const returnRatio = (Number(row.equity) - 10000) / 10000
                return (
                  <tr
                    key={row.user_id}
                    className={[
                      'border-b border-slate-800/40 last:border-0',
                      isMe ? 'bg-emerald-500/5' : 'hover:bg-slate-800/30',
                    ].join(' ')}
                  >
                    <td className="tabular-nums px-4 py-3 text-slate-500">{row.rank}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-white">{row.username}</span>
                      {isMe ? (
                        <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                          sen
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular-nums px-4 py-3 text-right text-slate-400">
                      {formatTRY(Number(row.cash_balance))}
                    </td>
                    <td className="tabular-nums px-4 py-3 text-right text-slate-400">
                      {formatTRY(Number(row.invested))}
                    </td>
                    <td className="tabular-nums px-4 py-3 text-right font-medium text-slate-100">
                      {formatTRY(Number(row.equity))}
                    </td>
                    <td
                      className={[
                        'tabular-nums px-4 py-3 text-right font-medium',
                        returnRatio >= 0 ? 'text-emerald-400' : 'text-rose-400',
                      ].join(' ')}
                    >
                      {formatPercent(returnRatio)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-slate-600">
        Getiri, 10.000 ₺ başlangıç sermayesine göre hesaplanır.
      </p>
    </PageShell>
  )
}
