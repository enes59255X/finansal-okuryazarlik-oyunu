import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { PageShell } from '../components/PageShell'
import { evaluateMissions, fetchMissions } from '../lib/api'
import { formatDate, formatTRY } from '../lib/format'
import type { Mission, PlayerMission } from '../lib/types'

type MissionRow = Mission & PlayerMission

const KIND_LABELS: Record<Mission['kind'], string> = {
  trade: 'İşlem',
  diversify: 'Çeşitlendirme',
  profit: 'Kâr',
  crisis: 'Kriz',
}

export function MissionsPage() {
  const { profile, refreshProfile } = useAuth()
  const [rows, setRows] = useState<MissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [justCompleted, setJustCompleted] = useState<string[]>([])

  const load = useCallback(async () => {
    setError(null)
    try {
      const completed = await evaluateMissions()
      if (completed.length > 0) {
        setJustCompleted(completed)
        await refreshProfile()
      }
      setRows(await fetchMissions())
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Görevler yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [refreshProfile])

  useEffect(() => {
    void load()
  }, [load])

  const done = rows.filter((row) => row.completed_at !== null)
  const earned = done.reduce((sum, row) => sum + Number(row.reward), 0)

  return (
    <PageShell
      title="Görevler"
      subtitle="Küçük hedefleri tamamla, cüzi maaş ödülleri kazan."
      actions={
        <div className="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Kazanılan</p>
          <p className="tabular-nums text-sm font-semibold text-emerald-300">{formatTRY(earned)}</p>
        </div>
      }
    >
      {justCompleted.length > 0 ? (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          Görev tamamlandı: <strong>{justCompleted.join(', ')}</strong>. Ödül bakiyene eklendi.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Tamamlanan" value={`${done.length} / ${rows.length}`} />
        <Stat label="Kalan ödül" value={formatTRY(rows.filter((row) => !row.completed_at).reduce((sum, row) => sum + Number(row.reward), 0))} />
        <Stat label="Nakit" value={formatTRY(Number(profile?.cash_balance ?? 0))} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {loading
          ? [0, 1, 2, 3].map((key) => (
              <div key={key} className="h-40 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-900/30" />
            ))
          : rows.map((row) => {
              const target = Math.max(1, Number(row.target))
              const progress = Math.min(Number(row.progress), target)
              const ratio = progress / target
              const completed = row.completed_at !== null

              return (
                <article
                  key={row.id}
                  className={[
                    'rounded-2xl border p-5 transition',
                    completed
                      ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                      : 'border-slate-800/70 bg-slate-900/40',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-800/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-300">
                          {KIND_LABELS[row.kind]}
                        </span>
                        {completed ? (
                          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
                            Tamamlandı
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-white">{row.title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{row.description}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Ödül</p>
                      <p className="tabular-nums text-sm font-semibold text-emerald-300">
                        {formatTRY(Number(row.reward))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>İlerleme</span>
                      <span className="tabular-nums">
                        {progress} / {target}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all ${completed ? 'bg-emerald-400' : 'bg-sky-500/70'}`}
                        style={{ width: `${Math.max(ratio * 100, progress > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </div>

                  {completed && row.completed_at ? (
                    <p className="mt-3 text-[10px] text-slate-500">
                      {formatDate(row.completed_at)} tarihinde tamamlandı
                    </p>
                  ) : null}
                </article>
              )
            })}
      </div>
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
