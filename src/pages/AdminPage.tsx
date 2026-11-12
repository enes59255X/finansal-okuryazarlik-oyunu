import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { PageShell } from '../components/PageShell'
import {
  adminGrantCash,
  adminPlayers,
  adminPublishNews,
  adminResetPlayer,
  adminSetPrice,
  adminSetTimeScale,
  adminTickNow,
  adminTriggerScenario,
  fetchAssets,
  fetchGameState,
  fetchScenarios,
} from '../lib/api'
import { formatDate, formatTRY } from '../lib/format'
import type { AdminPlayer, Asset, GameState, NewsItem, Scenario } from '../lib/types'

const SPEED_PRESETS = [1, 5, 30, 120, 720]
const SEVERITIES: NewsItem['severity'][] = ['info', 'warning', 'critical']
const KINDS: NewsItem['kind'][] = ['macro', 'stock', 'fund', 'crypto', 'commodity', 'bond', 'index']

export function AdminPage() {
  const { profile } = useAuth()
  const [state, setState] = useState<GameState | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const [nextState, nextScenarios, nextAssets, nextPlayers] = await Promise.all([
        fetchGameState(),
        fetchScenarios(),
        fetchAssets(),
        adminPlayers(),
      ])
      setState(nextState)
      setScenarios(nextScenarios)
      setAssets(nextAssets)
      setPlayers(nextPlayers)
    } catch (caught) {
      setMessage({ tone: 'err', text: caught instanceof Error ? caught.message : 'Yönetim verisi yüklenemedi.' })
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  const gameClock = useMemo(() => {
    if (!state) return '—'
    const started = new Date(state.game_started_at).getTime()
    const gameMs = started + (now - started) * Number(state.time_scale)
    return new Date(gameMs).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
  }, [state, now])

  if (profile?.role !== 'admin') {
    return (
      <PageShell title="Yönetim" subtitle="Bu alan yalnızca admin kullanıcılar içindir.">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">
          Yetkin yok. Bu sayfa sunucu tarafında da korunuyor; yalnızca arayüzü gizlemekle kalınmıyor.
        </div>
      </PageShell>
    )
  }

  async function run(action: () => Promise<string | void>) {
    setBusy(true)
    setMessage(null)
    try {
      const result = await action()
      setMessage({ tone: 'ok', text: typeof result === 'string' ? result : 'İşlem tamamlandı.' })
      await load()
    } catch (caught) {
      setMessage({ tone: 'err', text: caught instanceof Error ? caught.message : 'İşlem başarısız.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageShell title="Yönetim" subtitle="Oyun hızı, krizler, fiyatlar, haberler ve oyuncu yönetimi.">
      {message ? (
        <div
          className={[
            'mb-4 rounded-xl border px-4 py-3 text-sm',
            message.tone === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200',
          ].join(' ')}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold text-white">Oyun saati ve hız</h2>
          <p className="mt-1 text-xs text-slate-500">
            Oyun zamanı gerçek zamanla ilerler; çarpanı artırarak hızlandırabilirsin.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <Info label="Oyun saati" value={gameClock} />
            <Info label="Hız" value={`${Number(state?.time_scale ?? 1)}x`} />
            <Info label="Tick" value={`${state?.tick_seconds ?? 60} sn`} />
            <Info label="Son tick" value={state ? formatDate(state.last_tick_at) : '—'} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {SPEED_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={busy}
                onClick={() => void run(async () => {
                  await adminSetTimeScale(preset)
                  return `Hız ${preset}x olarak ayarlandı.`
                })}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50',
                  Number(state?.time_scale) === preset
                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 text-slate-300 hover:border-slate-600',
                ].join(' ')}
              >
                {preset}x
              </button>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(async () => {
                const ticks = await adminTickNow()
                return `Anında ${ticks} tick uygulandı.`
              })}
              className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 transition hover:bg-sky-500/20 disabled:opacity-50"
            >
              Anında tick
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5">
          <h2 className="text-sm font-semibold text-white">Kriz tetikle</h2>
          <p className="mt-1 text-xs text-slate-500">Senaryo, varlık fiyatlarına anında uygulanır ve haber yayınlanır.</p>
          <ul className="mt-3 space-y-2">
            {scenarios.map((scenario) => (
              <li
                key={scenario.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-800/70 bg-slate-950/40 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">{scenario.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{scenario.description}</p>
                  {scenario.triggered_at ? (
                    <p className="mt-1 text-[10px] text-amber-400/80">
                      Son tetikleme: {formatDate(scenario.triggered_at)}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(async () => {
                    await adminTriggerScenario(scenario.code)
                    return `${scenario.title} tetiklendi.`
                  })}
                  className="shrink-0 rounded-lg bg-rose-500/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:opacity-50"
                >
                  Tetikle
                </button>
              </li>
            ))}
          </ul>
        </section>

        <PriceForm assets={assets} busy={busy} onRun={run} />
        <NewsForm busy={busy} onRun={run} />
        <GrantForm players={players} busy={busy} onRun={run} />
        <PlayersTable players={players} busy={busy} onRun={run} />
      </div>
    </PageShell>
  )
}

function PriceForm({ assets, busy, onRun }: { assets: Asset[]; busy: boolean; onRun: (fn: () => Promise<string | void>) => Promise<void> }) {
  const [symbol, setSymbol] = useState('')
  const [price, setPrice] = useState('')

  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold text-white">Fiyat ayarla</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-400">
          Sembol
          <input
            list="asset-symbols"
            value={symbol}
            onChange={(event) => setSymbol(event.target.value.toUpperCase())}
            placeholder="THYAO"
            className="input mt-1"
          />
          <datalist id="asset-symbols">
            {assets.map((asset) => (
              <option key={asset.id} value={asset.symbol} />
            ))}
          </datalist>
        </label>
        <label className="block text-xs text-slate-400">
          Yeni fiyat
          <input
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="300.00"
            className="input mt-1"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={busy || !symbol || !price}
        onClick={() => void onRun(async () => {
          await adminSetPrice(symbol, Number(price.replace(',', '.')))
          setPrice('')
          return `${symbol} fiyatı güncellendi.`
        })}
        className="mt-3 w-full rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-600 disabled:opacity-50"
      >
        Fiyatı uygula
      </button>
    </section>
  )
}

function NewsForm({ busy, onRun }: { busy: boolean; onRun: (fn: () => Promise<string | void>) => Promise<void> }) {
  const [headline, setHeadline] = useState('')
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState<NewsItem['severity']>('info')
  const [kind, setKind] = useState<NewsItem['kind']>('macro')
  const [symbols, setSymbols] = useState('')

  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold text-white">Haber yayınla</h2>
      <div className="mt-3 space-y-2">
        <input
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          placeholder="Başlık"
          className="input"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Kısa açıklama"
          rows={2}
          className="input resize-none"
        />
        <div className="grid grid-cols-2 gap-2">
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value as NewsItem['severity'])}
            className="input"
          >
            {SEVERITIES.map((value) => (
              <option key={value} value={value}>
                {value === 'info' ? 'Bilgi' : value === 'warning' ? 'Uyarı' : 'Kritik'}
              </option>
            ))}
          </select>
          <select value={kind} onChange={(event) => setKind(event.target.value as NewsItem['kind'])} className="input">
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <input
          value={symbols}
          onChange={(event) => setSymbols(event.target.value.toUpperCase())}
          placeholder="İlgili semboller: THYAO, BTC"
          className="input"
        />
      </div>
      <button
        type="button"
        disabled={busy || headline.trim().length < 5}
        onClick={() => void onRun(async () => {
          await adminPublishNews({
            headline,
            body,
            severity,
            kind,
            symbols: symbols.split(',').map((item) => item.trim()).filter(Boolean),
          })
          setHeadline('')
          setBody('')
          setSymbols('')
          return 'Haber yayınlandı.'
        })}
        className="mt-3 w-full rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        Yayınla
      </button>
    </section>
  )
}

function GrantForm({ players, busy, onRun }: { players: AdminPlayer[]; busy: boolean; onRun: (fn: () => Promise<string | void>) => Promise<void> }) {
  const [username, setUsername] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')

  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5">
      <h2 className="text-sm font-semibold text-white">Nakit ekle / çıkar</h2>
      <p className="mt-1 text-xs text-slate-500">Negatif tutar bakiyeden düşer. İşlem deftere kaydedilir.</p>
      <div className="mt-3 space-y-2">
        <input
          list="player-names"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Oyuncu adı"
          className="input"
        />
        <datalist id="player-names">
          {players.map((player) => (
            <option key={player.user_id} value={player.username} />
          ))}
        </datalist>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Tutar (örn. 500 veya -250)"
          className="input"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Not (opsiyonel)"
          className="input"
        />
      </div>
      <button
        type="button"
        disabled={busy || !username || !amount}
        onClick={() => void onRun(async () => {
          await adminGrantCash(username, Number(amount.replace(',', '.')), note)
          setAmount('')
          setNote('')
          return 'Bakiye güncellendi.'
        })}
        className="mt-3 w-full rounded-lg border border-slate-700 py-2 text-xs font-medium text-slate-200 transition hover:border-slate-600 disabled:opacity-50"
      >
        Uygula
      </button>
    </section>
  )
}

function PlayersTable({ players, busy, onRun }: { players: AdminPlayer[]; busy: boolean; onRun: (fn: () => Promise<string | void>) => Promise<void> }) {
  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-5 lg:col-span-2">
      <h2 className="text-sm font-semibold text-white">Oyuncular ({players.length})</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-800/70 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
              <th className="px-2 py-2 font-medium">Oyuncu</th>
              <th className="px-2 py-2 text-right font-medium">Nakit</th>
              <th className="px-2 py-2 text-right font-medium">Yatırım</th>
              <th className="px-2 py-2 text-right font-medium">Toplam</th>
              <th className="px-2 py-2 text-right font-medium">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.user_id} className="border-b border-slate-800/40 last:border-0">
                <td className="px-2 py-2.5">
                  <span className="font-medium text-slate-100">{player.username}</span>
                  {player.role === 'admin' ? (
                    <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] text-sky-300">admin</span>
                  ) : null}
                </td>
                <td className="tabular-nums px-2 py-2.5 text-right text-slate-400">{formatTRY(Number(player.cash_balance))}</td>
                <td className="tabular-nums px-2 py-2.5 text-right text-slate-400">{formatTRY(Number(player.invested))}</td>
                <td className="tabular-nums px-2 py-2.5 text-right font-medium text-slate-100">{formatTRY(Number(player.equity))}</td>
                <td className="px-2 py-2.5 text-right">
                  <button
                    type="button"
                    disabled={busy || player.role === 'admin'}
                    onClick={() => {
                      if (!window.confirm(`${player.username} sıfırlansın mı? Portföy ve işlem geçmişi silinir.`)) return
                      void onRun(async () => {
                        await adminResetPlayer(player.username)
                        return `${player.username} sıfırlandı.`
                      })
                    }}
                    className="rounded-md border border-rose-500/30 px-2 py-1 text-[11px] text-rose-300 transition hover:bg-rose-500/10 disabled:opacity-40"
                  >
                    Sıfırla
                  </button>
                </td>
              </tr>
            ))}
            {players.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-xs text-slate-500">
                  Oyuncu yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-950/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-200">{value}</p>
    </div>
  )
}
