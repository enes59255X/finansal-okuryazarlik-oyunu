import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { placeOrder } from '../lib/api'
import { formatPercent, formatQty, formatTRY } from '../lib/format'
import { round2 } from '../lib/portfolio'
import type { Asset, Position } from '../lib/types'

interface TradePanelProps {
  asset: Asset
  position: Position | null
  onTraded: () => void
}

export function TradePanel({ asset, position, onTraded }: TradePanelProps) {
  const { profile, refreshProfile } = useAuth()
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [shares, setShares] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const cash = Number(profile?.cash_balance ?? 0)
  const price = Number(asset.current_price)
  const owned = Number(position?.shares ?? 0)
  const avgPrice = Number(position?.average_buy_price ?? 0)

  const quantity = useMemo(() => {
    const parsed = Number(shares.replace(',', '.'))
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 10000) / 10000 : 0
  }, [shares])

  const gross = round2(quantity * price)
  const maxBuyable = price > 0 ? Math.floor((cash / price) * 10000) / 10000 : 0

  useEffect(() => {
    setShares('')
    setSide('buy')
    setError(null)
    setSuccess(null)
  }, [asset.id])

  const validation = useMemo(() => {
    if (quantity <= 0) return null
    if (side === 'buy' && gross > cash) return 'Yetersiz bakiye.'
    if (side === 'sell' && quantity > owned) return 'Elinizde bu kadar adet yok.'
    return null
  }, [quantity, side, gross, cash, owned])

  async function handleSubmit() {
    setError(null)
    setSuccess(null)

    if (quantity <= 0) {
      setError('Geçerli bir adet gir.')
      return
    }
    if (validation) {
      setError(validation)
      return
    }

    setBusy(true)
    try {
      await placeOrder(side, asset.id, quantity)
      await refreshProfile()
      onTraded()
      setSuccess(
        side === 'buy'
          ? `${formatQty(quantity)} ${asset.symbol} alındı.`
          : `${formatQty(quantity)} ${asset.symbol} satıldı.`,
      )
      setShares('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'İşlem gerçekleşmedi.')
    } finally {
      setBusy(false)
    }
  }

  const projection = side === 'buy' ? cash - gross : cash + gross

  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
        {(['buy', 'sell'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setSide(item)
              setError(null)
              setSuccess(null)
            }}
            className={[
              'rounded-lg py-2 text-sm font-semibold transition',
              side === item
                ? item === 'buy'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-rose-500/15 text-rose-300'
                : 'text-slate-400 hover:text-slate-200',
            ].join(' ')}
          >
            {item === 'buy' ? 'Al' : 'Sat'}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <label htmlFor="shares" className="text-xs font-medium text-slate-400">
            Adet
          </label>
          <span className="text-[11px] text-slate-500">
            {side === 'buy' ? `Maks. ${formatQty(maxBuyable)}` : `Elinde ${formatQty(owned)}`}
          </span>
        </div>
        <input
          id="shares"
          inputMode="decimal"
          value={shares}
          onChange={(event) => {
            setShares(event.target.value)
            setError(null)
            setSuccess(null)
          }}
          placeholder="0"
          className="input tabular-nums mt-1.5 text-right text-lg"
        />
        <div className="mt-2 grid grid-cols-4 gap-1">
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <button
              key={ratio}
              type="button"
              onClick={() => {
                const max = side === 'buy' ? maxBuyable : owned
                const value = Math.floor(max * ratio * 10000) / 10000
                setShares(value > 0 ? String(value) : '')
              }}
              className="rounded-md border border-slate-800 py-1 text-[11px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
            >
              %{ratio * 100}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-4 space-y-1.5 rounded-xl bg-slate-950/50 p-3 text-xs">
        <Row label="Birim fiyat" value={formatTRY(price)} />
        <Row label="İşlem tutarı" value={formatTRY(gross)} strong />
        <Row label={side === 'buy' ? 'İşlem sonrası nakit' : 'Satış sonrası nakit'} value={formatTRY(projection)} />
        {side === 'sell' && quantity > 0 ? (
          <Row
            label="Tahmini kâr / zarar"
            value={formatPercent(avgPrice > 0 ? (price - avgPrice) / avgPrice : 0)}
            tone={price >= avgPrice ? 'up' : 'down'}
          />
        ) : null}
      </dl>

      {error ? (
        <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {success}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={busy || quantity <= 0 || Boolean(validation)}
        className={[
          'mt-4 w-full rounded-lg py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
          side === 'buy'
            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            : 'bg-rose-500 text-white hover:bg-rose-400',
        ].join(' ')}
      >
        {busy ? 'İşleniyor…' : side === 'buy' ? 'Satın al' : 'Sat'}
      </button>

      <p className="mt-3 text-center text-[10px] leading-relaxed text-slate-600">
        Emirler atomik olarak veritabanında işlenir; bakiye istemci tarafından değiştirilemez.
      </p>
    </section>
  )
}

function Row({ label, value, strong = false, tone }: {
  label: string
  value: string
  strong?: boolean
  tone?: 'up' | 'down'
}) {
  const toneClass = tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : 'text-slate-200'
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold' : ''} ${toneClass}`}>{value}</dd>
    </div>
  )
}
