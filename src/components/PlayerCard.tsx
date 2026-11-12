import type { ReactNode } from 'react'
import { formatPercent, formatTRY } from '../lib/format'
import type { PlayerAsset } from '../lib/types'

interface PlayerCardProps {
  player: PlayerAsset
  footer?: ReactNode
  compact?: boolean
}

const TIERS: Array<{ min: number; from: string; to: string; ring: string }> = [
  { min: 85, from: 'from-amber-400/25', to: 'to-amber-600/10', ring: 'ring-amber-400/40' },
  { min: 78, from: 'from-slate-200/20', to: 'to-slate-400/10', ring: 'ring-slate-300/30' },
  { min: 70, from: 'from-sky-400/20', to: 'to-sky-600/10', ring: 'ring-sky-400/30' },
  { min: 0, from: 'from-slate-700/30', to: 'to-slate-800/20', ring: 'ring-slate-600/30' },
]

export function PlayerCard({ player, footer, compact = false }: PlayerCardProps) {
  const stats = player.player_stats
  if (!stats) return null

  const tier = TIERS.find((item) => stats.overall >= item.min) ?? TIERS[3]!
  const isKeeper = stats.position_group === 'GK'

  return (
    <article
      className={[
        'relative overflow-hidden rounded-2xl border border-slate-800/70 bg-gradient-to-br ring-1',
        tier.from,
        tier.to,
        tier.ring,
        compact ? 'p-3.5' : 'p-4',
      ].join(' ')}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="tabular-nums text-2xl font-black leading-none text-white">{stats.overall}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            {stats.position}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">Değer</p>
          <p className="tabular-nums text-sm font-semibold text-white">{formatTRY(Number(player.current_price))}</p>
          <p
            className={[
              'tabular-nums text-[10px]',
              stats.form >= 0 ? 'text-emerald-300' : 'text-rose-300',
            ].join(' ')}
          >
            form {stats.form >= 0 ? '+' : ''}
            {stats.form.toFixed(2).replace('.', ',')}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-white/10 pt-2">
        <p className="truncate text-sm font-semibold text-white">{player.name}</p>
        <p className="text-[10px] text-slate-400">
          {stats.club ?? '11B FC'}
          {stats.age ? ` · ${stats.age} yaş` : ''}
        </p>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-x-2 gap-y-1 text-[10px]">
        {isKeeper ? (
          <>
            <Stat label="DIV" value={stats.gk_diving} />
            <Stat label="HAN" value={stats.gk_handling} />
            <Stat label="KIC" value={stats.gk_kicking} />
            <Stat label="REF" value={stats.gk_reflexes} />
            <Stat label="SPE" value={stats.gk_speed} />
            <Stat label="POS" value={stats.gk_positioning} />
          </>
        ) : (
          <>
            <Stat label="PAC" value={stats.pace} />
            <Stat label="SHO" value={stats.shooting} />
            <Stat label="PAS" value={stats.passing} />
            <Stat label="DRI" value={stats.dribbling} />
            <Stat label="DEF" value={stats.defending} />
            <Stat label="PHY" value={stats.physical} />
          </>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>
          {stats.matches} maç · {stats.goals} gol · {stats.assists} asist
        </span>
        <span className="tabular-nums">{formatPercent((Number(player.current_price) - Number(player.previous_close ?? player.current_price)) / Math.max(1, Number(player.previous_close ?? player.current_price)))}</span>
      </div>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </article>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-1 rounded bg-black/20 px-1.5 py-0.5">
      <span className="font-semibold text-slate-400">{label}</span>
      <span className="tabular-nums font-semibold text-slate-100">{value ?? '—'}</span>
    </div>
  )
}
