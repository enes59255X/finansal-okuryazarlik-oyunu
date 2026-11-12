import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { fetchLedger, transferCash } from '../lib/api'
import { formatDate, formatTRY } from '../lib/format'
import { LEDGER_LABELS, type LedgerEntry } from '../lib/types'

export function TransferCard() {
  const { refreshProfile } = useAuth()
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])

  const load = useCallback(async () => {
    try {
      setLedger(await fetchLedger(8))
    } catch {
      setLedger([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function submit() {
    setError(null)
    setOk(null)
    setBusy(true)
    try {
      await transferCash(to.trim(), Number(amount.replace(',', '.')), note.trim() || undefined)
      await refreshProfile()
      await load()
      setOk(`${to.trim()} kullanıcısına gönderildi.`)
      setAmount('')
      setNote('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Transfer başarısız.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-white">Para gönder</h2>
      <p className="mt-1 text-[11px] text-slate-500">İşlem başına en fazla 5.000 ₺, günlük 20.000 ₺.</p>

      <div className="mt-3 space-y-2">
        <input
          value={to}
          onChange={(event) => setTo(event.target.value)}
          placeholder="Alıcı kullanıcı adı"
          className="input"
        />
        <input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Tutar"
          className="input"
        />
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={120}
          placeholder="Not (opsiyonel)"
          className="input"
        />
      </div>

      {error ? <p className="mt-2 text-[11px] text-rose-300">{error}</p> : null}
      {ok ? <p className="mt-2 text-[11px] text-emerald-300">{ok}</p> : null}

      <button
        type="button"
        disabled={busy || to.trim().length < 3 || !amount}
        onClick={() => void submit()}
        className="mt-3 w-full rounded-lg bg-sky-500/90 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50"
      >
        {busy ? 'Gönderiliyor…' : 'Gönder'}
      </button>

      <div className="mt-5 border-t border-slate-800/70 pt-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Nakit hareketleri</h3>
        <ul className="mt-2 space-y-2">
          {ledger.length === 0 ? (
            <li className="text-[11px] text-slate-600">Kayıt yok.</li>
          ) : (
            ledger.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-2 text-[11px]">
                <div className="min-w-0">
                  <p className="truncate text-slate-300">{entry.note ?? LEDGER_LABELS[entry.kind]}</p>
                  <p className="text-[10px] text-slate-600">{formatDate(entry.created_at)}</p>
                </div>
                <span
                  className={`tabular-nums shrink-0 font-medium ${
                    Number(entry.amount) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {Number(entry.amount) >= 0 ? '+' : ''}
                  {formatTRY(Number(entry.amount))}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  )
}
