import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { PriceChart } from '../components/PriceChart'
import { TradePanel } from '../components/TradePanel'
import { useAuth } from '../auth/useAuth'
import { fetchAsset, fetchPositions, fetchPriceHistory } from '../lib/api'
import { formatPercent, formatQty, formatTRY } from '../lib/format'
import { dayChangeRatio, round2 } from '../lib/portfolio'
import { CATEGORY_LABELS, type Asset, type Position, type PricePoint } from '../lib/types'

export function AssetPage() {
  const { assetId } = useParams<{ assetId: string }>()
  const { profile } = useAuth()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [history, setHistory] = useState<PricePoint[]>([])
  const [position, setPosition] = useState<Position | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!assetId || !profile) return
    setError(null)
    try {
      const [nextAsset, nextHistory, nextPositions] = await Promise.all([
        fetchAsset(assetId),
        fetchPriceHistory(assetId),
        fetchPositions(profile.id),
      ])
      setAsset(nextAsset)
      setHistory(nextHistory)
      setPosition(nextPositions.find((item) => item.asset_id === assetId) ?? null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Varlık yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [assetId, profile])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <PageShell title="Yükleniyor…">
        <div className="h-64 animate-pulse rounded-2xl border border-slate-800/70 bg-slate-900/30" />
      </PageShell>
    )
  }

  if (!asset) {
    return (
      <PageShell title="Varlık bulunamadı" subtitle={error ?? 'Aradığın varlık mevcut değil.'}>
        <Link to="/" className="text-sm text-emerald-400 hover:underline">
          Piyasaya dön
        </Link>
      </PageShell>
    )
  }

  const ratio = dayChangeRatio(asset)
  const shares = Number(position?.shares ?? 0)
  const avgPrice = Number(position?.average_buy_price ?? 0)
  const marketValue = round2(shares * Number(asset.current_price))
  const cost = round2(shares * avgPrice)
  const pnl = round2(marketValue - cost)

  return (
    <PageShell
      title={asset.name}
      subtitle={`${asset.symbol} · ${CATEGORY_LABELS[asset.category]}`}
      actions={
        <Link to="/" className="text-xs text-slate-400 transition hover:text-slate-200">
          ← Piyasa
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="tabular-nums text-3xl font-semibold text-white">
                  {formatTRY(Number(asset.current_price))}
                </p>
                <p
                  className={[
                    'tabular-nums mt-1 text-sm font-medium',
                    ratio > 0 ? 'text-emerald-400' : ratio < 0 ? 'text-rose-400' : 'text-slate-400',
                  ].join(' ')}
                >
                  {formatPercent(ratio)} · günlük
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <p>Önceki kapanış: {formatTRY(Number(asset.previous_close ?? 0))}</p>
                <p>Volatilite: {formatPercent(Number(asset.volatility), false)}</p>
              </div>
            </div>

            <div className="mt-4">
              <PriceChart points={history} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5">
            <h2 className="text-sm font-semibold text-white">Pozisyonun</h2>
            {shares > 0 ? (
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Adet" value={formatQty(shares)} />
                <Stat label="Ortalama maliyet" value={formatTRY(avgPrice)} />
                <Stat label="Piyasa değeri" value={formatTRY(marketValue)} />
                <Stat
                  label="Kâr / zarar"
                  value={formatTRY(pnl)}
                  tone={pnl >= 0 ? 'up' : 'down'}
                />
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Bu varlıkta pozisyonun yok. Sağdaki panelden ilk alımını yapabilirsin.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/30 p-5 text-xs leading-relaxed text-slate-400">
            <h2 className="text-sm font-semibold text-white">Nasıl çalışır?</h2>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>Alım ve satım emirleri veritabanı fonksiyonuyla atomik olarak işlenir.</li>
              <li>Ortalama maliyet, her alımda ağırlıklı ortalama ile güncellenir.</li>
              <li>Satışta gerçekleşen kâr/zarar işlem geçmişine kaydedilir.</li>
              <li>Fiyatlar Faz 2'de piyasa motoru ve kriz senaryolarıyla hareket edecek.</li>
            </ul>
          </div>
        </section>

        <TradePanel asset={asset} position={position} onTraded={() => void load()} />
      </div>
    </PageShell>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  const color = tone === 'up' ? 'text-emerald-300' : tone === 'down' ? 'text-rose-300' : 'text-slate-100'
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</dt>
      <dd className={`tabular-nums mt-1 text-sm font-semibold ${color}`}>{value}</dd>
    </div>
  )
}
