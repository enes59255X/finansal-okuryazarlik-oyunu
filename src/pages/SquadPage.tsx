import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../auth/useAuth'
import { PageShell } from '../components/PageShell'
import { PlayerCard } from '../components/PlayerCard'
import { fetchCareerMatches, fetchPlayers, fetchPositions, playMatch } from '../lib/api'
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
        fetchCareerMatches(8),
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

  const squad = useMemo(
    () =>
      players
        .filter((player) => (owned.get(player.id) ?? 0) > 0)
        .sort((a, b) => (b.player_stats?.overall ?? 0) - (a.player_stats?.overall ?? 0)),
    [players, owned],
  )

  const squadValue = squad.reduce((sum, player) => sum + Number(player.current_price) * (owned.get(player.id) ?? 0), 0)
  const averageRating = squad.length
    ? squad.reduce((sum, player) => sum + (player.player_stats?.overall ?? 0), 0) / squad.length
    : 0
  const wins = matches.filter((match) => match.result === 'win').length
  const draws = matches.filter((match) => match.result === 'draw').length
  const losses = matches.filter((match) => match.result === 'loss').length
  const goals = matches.reduce((sum, match) => sum + match.goals_for, 0)

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
    <PageShell title="Kulüp" subtitle="Kadronu kur, maça çık, oyuncularını geliştir.">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/15 via-slate-900/60 to-slate-950 p-6 shadow-2xl shadow-black/40 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-xl font-black text-slate-950 shadow-lg shadow-emerald-500/30">
              11B
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-300/80">11B FC · Teknik Direktör</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                {profile?.username}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {wins}G {draws}B {losses}M · {goals} gol · kadro ortalaması{' '}
                <span className="tabular-nums text-slate-200">{averageRating.toFixed(1)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-end gap-6">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Kadro değeri</p>
              <p className="tabular-nums mt-1 text-2xl font-semibold text-white">{formatTRY(squadValue)}</p>
              <p className="mt-1 text-[11px] text-slate-500">{squad.length} oyuncu</p>
            </div>
            <button
              type="button"
              onClick={() => void kickOff()}
              disabled={busy || squad.length < 5}
              className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Maç oynanıyor…' : squad.length < 5 ? `${5 - squad.length} oyuncu daha` : 'Maça çık'}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Son form" value={matches.slice(0, 5).map((match) => (match.result === 'win' ? 'G' : match.result === 'draw' ? 'B' : 'M')).join(' · ') || '—'} />
        <Stat label="Atılan / yenilen" value={`${goals} / ${matches.reduce((sum, match) => sum + match.goals_against, 0)}`} />
        <Stat label="Kaleci" value={String(squad.filter((player) => player.player_stats?.position_group === 'GK').length)} />
        <Stat label="Nakit" value={formatTRY(Number(profile?.cash_balance ?? 0))} />
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-sm font-semibold text-white">Kadro</h2>
          <span className="text-[11px] text-slate-500">{squad.length} oyuncu</span>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((key) => (
              <div key={key} className="h-64 animate-pulse rounded-3xl border border-slate-800/70 bg-slate-900/30" />
            ))}
          </div>
        ) : squad.length === 0 ? (
          <p className="rounded-3xl border border-slate-800/70 bg-slate-900/30 p-8 text-center text-sm text-slate-500">
            Kadron henüz oluşmadı. Yönetim kadro atadığında burada görünecek.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {squad.map((player) => (
              <PlayerCard key={player.id} player={player} size="lg" />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-900/40">
        <h2 className="border-b border-slate-800/70 px-5 py-4 text-sm font-semibold text-white">Maç geçmişi</h2>
        <ul className="divide-y divide-slate-800/50">
          {matches.length === 0 ? (
            <li className="px-5 py-8 text-center text-sm text-slate-500">Henüz maç yapmadın.</li>
          ) : (
            matches.map((match) => (
              <li key={match.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-200">
                    <span className="font-medium">11B FC</span>{' '}
                    <span className="tabular-nums">
                      {match.goals_for} - {match.goals_against}
                    </span>{' '}
                    {match.opponent}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatDate(match.played_at)} · kadro gücü {match.squad_rating ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
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
                </div>
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
            className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setResult(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220] shadow-2xl"
            >
              <div
                className={[
                  'h-1.5 w-full',
                  result.result === 'win'
                    ? 'bg-emerald-400'
                    : result.result === 'draw'
                      ? 'bg-slate-400'
                      : 'bg-rose-400',
                ].join(' ')}
              />
              <div className="p-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Maç sonucu</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">
                  11B FC {result.goals_for} - {result.goals_against} {result.opponent}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {result.result === 'win' ? 'Galibiyet' : result.result === 'draw' ? 'Beraberlik' : 'Mağlubiyet'} · ödül{' '}
                  <span className="text-emerald-300">{formatTRY(Number(result.reward))}</span>
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
                  className="mt-5 w-full rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  Kapat
                </button>
              </div>
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
