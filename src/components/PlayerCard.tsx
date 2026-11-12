import type { ReactNode } from 'react'
import { formatPercent, formatTRY } from '../lib/format'
import type { PlayerAsset } from '../lib/types'

interface PlayerCardProps {
  player: PlayerAsset
  footer?: ReactNode
  size?: 'md' | 'lg'
}

const TIERS = [
  { min: 85, ring: 'ring-amber-300/50', glow: 'from-amber-300/25 via-amber-500/5', accent: 'text-amber-200', bar: 'bg-amber-300' },
  { min: 78, ring: 'ring-slate-200/40', glow: 'from-slate-200/20 via-slate-400/5', accent: 'text-slate-100', bar: 'bg-slate-200' },
  { min: 70, ring: 'ring-sky-400/40', glow: 'from-sky-400/20 via-sky-600/5', accent: 'text-sky-200', bar: 'bg-sky-400' },
  { min: 0, ring: 'ring-slate-600/40', glow: 'from-slate-500/15 via-slate-700/5', accent: 'text-slate-300', bar: 'bg-slate-400' },
]

export function PlayerCard({ player, footer, size = 'md' }: PlayerCardProps) {
  const stats = player.player_stats
  if (!stats) return null

  const tier = TIERS.find((item) => stats.overall >= item.min) ?? TIERS[3]!
  const isKeeper = stats.position_group === 'GK'
  const price = Number(player.current_price)
  const previous = Number(player.previous_close ?? price)
  const change = (price - previous) / Math.max(1, previous)
  const initials = player.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const bars = isKeeper
    ? [
        { label: 'DIV', value: stats.gk_diving },
        { label: 'HAN', value: stats.gk_handling },
        { label: 'KIC', value: stats.gk_kicking },
        { label: 'REF', value: stats.gk_reflexes },
        { label: 'SPE', value: stats.gk_speed },
        { label: 'POS', value: stats.gk_positioning },
      ]
    : [
        { label: 'PAC', value: stats.pace },
        { label: 'SHO', value: stats.shooting },
        { label: 'PAS', value: stats.passing },
        { label: 'DRI', value: stats.dribbling },
        { label: 'DEF', value: stats.defending },
        { label: 'PHY', value: stats.physical },
      ]

  return (
    <article
      className={[
        'group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0b1220] ring-1 shadow-2xl shadow-black/40 transition duration-300 hover:-translate-y-1 hover:shadow-black/60',
        tier.ring,
        size === 'lg' ? 'p-5' : 'p-4',
      ].join(' ')}
    >
      <div aria-hidden className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tier.glow} to-transparent`} />
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/[0.06] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-end gap-2.5">
          <span className={`tabular-nums font-black leading-none ${tier.accent} ${size === 'lg' ? 'text-5xl' : 'text-4xl'}`}>
            {stats.overall}
          </span>
          <span className="mb-1 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-200 ring-1 ring-white/10">
            {stats.position}
          </span>
        </div>

        <div className="text-right">
          <p className="tabular-nums text-sm font-semibold text-white">{formatTRY(price)}</p>
          <p className={`tabular-nums text-[11px] font-medium ${change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {formatPercent(change)}
          </p>
        </div>
      </div>

      <div className="relative mt-3.5 flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/40 text-[10px] font-bold text-slate-300 ring-1 ring-white/10">
          {initials}
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-tight text-white">{player.name}</p>
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">
            {stats.club ?? '11B FC'}
            {stats.age ? ` · ${stats.age} yaş` : ''}
          </p>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {bars.map((bar) => (
          <StatBar key={bar.label} label={bar.label} value={bar.value} barClass={tier.bar} />
        ))}
      </div>

      <div className="relative mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-[10px] text-slate-400">
        <span>
          {stats.matches} maç · {stats.goals} gol · {stats.assists} asist
        </span>
        <span className={stats.form >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
          form {stats.form >= 0 ? '+' : ''}
          {stats.form.toFixed(2).replace('.', ',')}
        </span>
      </div>

      {footer ? <div className="relative mt-3">{footer}</div> : null}
    </article>
  )
}

function StatBar({ label, value, barClass }: { label: string; value: number | null; barClass: string }) {
  const safe = value ?? 0
  return (
    <div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-medium tracking-[0.08em] text-slate-400">{label}</span>
        <span className="tabular-nums font-semibold text-slate-100">{value ?? '—'}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${safe}%` }} />
      </div>
    </div>
  )
}
