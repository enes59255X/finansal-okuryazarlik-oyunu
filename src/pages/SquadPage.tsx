import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../auth/useAuth'
import { PageShell } from '../components/PageShell'
import { PlayerCard } from '../components/PlayerCard'
import { fetchCareerMatches, fetchPlayers, fetchPositions, placeOrder, playMatch } from '../lib/api'
import { formatDate, formatTRY } from '../lib/format'
import type { CareerMatch, MatchResult, PlayerAsset, Position } from '../lib/types'

export function SquadPage() {
  const { profile, refreshProfile } = useAuth()
  const [players, setPlayers] = useState<PlayerAsset[]>([])
  const [positions, setPositions] = useState<Position[]>([])
  const [matches, setMatches] = useState<CareerMatch[]>([])
  const [result, setResult] = useState<MatchResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!profile) return
    try {
      const [nextPlayers, nextPositions, nextMatches] = await Promise.all([
        fetchPlayers(),
        fetchPositions(profile.id),
        fetchCareerMatches(6),
      ])
      setPlayers(nextPlayers)
      setPositions(nextPositions)
      setMatches(nextMatches)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kadro yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    void load()
  }, [load])

  const owned = useMemo(() => {
    const map = new Map<string, number>()
    for (const position of positions) map.set(position.asset_id, Number(position.shares))
    return map
  }, [positions])

  const squad = players.filter((player) => (owned.get(player.id) ?? 0) > 0)
  const market = players.filter((player) => (owned.get(player.id) ?? 0) <= 0)
  const squadValue = squad.reduce((sum, player) => sum + Number(player.current_price) * (owned.get(player.id) ?? 0), 0)
  const wins = matches.filter((match) => match.result === 'win').length
  const goals = matches.reduce((sum, match) => sum + match.goals_for, 0)

  async function trade(player: PlayerAsset, side: 'buy' | 'sell') {
    setError(null)
    setBusy(true)
    try {
      await placeOrder(side, player.id, 1)
      await refreshProfile()
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'İşlem gerçekleşmedi.')
    } finally {
      setBusy(false)
    }
  }

  async function kickOff() {
    setError(null)
    setBusy(true)
    try {
      const next = await playMatch()
      setResult(next)
      await refreshProfile()
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Maç oynanamadı.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell
      title="Kadro"
      subtitle="Oyuncu kartlarını topla, maça çık, performansla değerini büyüt."
      actions={
        <button
          type="button"
          onClick={() => void kickOff()}
          disabled={busy || squad.length < 5}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'İşleniyor…' : squad.length < 5 ? `Maç için ${5 - squad.length} oyuncu daha` : 'Maç yap'}
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Kadro değeri" value={formatTRY(squadValue)} />
        <Stat label="Oyuncu" value={`${squad.length} / 11`} />
        <Stat label="Son maçlar" value={`${wins} galibiyet`} />
        <Stat label="Atılan gol" value={String(goals)} />
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-white">İlk 11'in</h2>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-44 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-900/30" />
            ))}
          </div>
        ) : squad.length === 0 ? (
          <p className="rounded-2xl border border-slate-800/70 bg-slate-900/30 p-6 text-sm text-slate-500">
            Kadron boş. Aşağıdaki transfer pazarından oyuncu al.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {squad.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                footer={
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      {owned.get(player.id)} adet · {formatTRY(Number(player.current_price) * (owned.get(player.id) ?? 1))}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void trade(player, 'sell')}
                      className="rounded-lg border border-rose-500/30 px-2 py-1 text-[11px] font-medium text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-50"
                    >
                      Sat
                    </button>
                  </div>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-white">Transfer pazarı</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {market.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              compact
              footer={
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void trade(player, 'buy')}
                  className="w-full rounded-lg bg-emerald-500/90 py-1.5 text-[11px] font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                >
                  {formatTRY(Number(player.current_price))} · Transfer et
                </button>
              }
            />
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-800/70 bg-slate-900/40">
        <h2 className="border-b border-slate-800/70 px-5 py-3.5 text-sm font-semibold text-white">Maç geçmişi</h2>
        <ul className="divide-y divide-slate-800/50">
          {matches.length === 0 ? (
            <li className="px-5 py-6 text-sm text-slate-500">Henüz maç yapmadın.</li>
          ) : (
            matches.map((match) => (
              <li key={match.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm text-slate-200">
                    <span className="font-medium">11B FC</span> {match.goals_for} - {match.goals_against}{' '}
                    {match.opponent}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatDate(match.played_at)} · kadro {match.squad_rating ?? '—'}
                  </p>
                </div>
                <span
                  className={[
                    'rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                    match.result === 'win'
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : match.result === 'draw'
                        ? 'bg-slate-500/15 text-slate-300'
                        : 'bg-rose-500/15 text-rose-300',
                  ].join(' ')}
                >
                  {match.result === 'win' ? 'Galibiyet' : match.result === 'draw' ? 'Beraberlik' : 'Mağlubiyet'}
                </span>
                <span className="tabular-nums text-xs text-emerald-300">+{formatTRY(Number(match.reward))}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <AnimatePresence>
        {result ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
            onClick={() => setResult(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6"
            >
              <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Maç sonucu</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">
                11B FC {result.goals_for} - {result.goals_against} {result.opponent}
              </h3>
              <p className="mt-1 text-sm text-slate-400">
                {result.result === 'win' ? 'Galibiyet' : result.result === 'draw' ? 'Beraberlik' : 'Mağlubiyet'} ·
                ödül <span className="text-emerald-300">{formatTRY(Number(result.reward))}</span>
              </p>

              <ul className="mt-4 max-h-52 space-y-1.5 overflow-y-auto text-xs">
                {result.events.length === 0 ? (
                  <li className="text-slate-500">Gol olmadı.</li>
                ) : (
                  result.events.map((event, index) => (
                    <li key={`${event.minute}-${index}`} className="flex items-center gap-2 text-slate-300">
                      <span className="tabular-nums w-8 text-slate-500">{event.minute}'</span>
                      <span className="text-emerald-400">⚽</span>
                      <span>{event.player}</span>
                    </li>
                  ))
                )}
              </ul>

              <button
                type="button"
                onClick={() => setResult(null)}
                className="mt-5 w-full rounded-lg bg-slate-800 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
              >
                Kapat
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </PageShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="tabular-nums mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  )
}
