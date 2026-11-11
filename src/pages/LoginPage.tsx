import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../auth/useAuth'

type Mode = 'login' | 'register'

export function LoginPage() {
  const { session, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session) navigate('/', { replace: true })
  }, [session, navigate])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)

    try {
      if (mode === 'login') {
        await signIn(email.trim(), password)
      } else {
        if (username.trim().length < 3) throw new Error('Kullanıcı adı en az 3 karakter olmalı.')
        const { needsConfirmation } = await signUp(email.trim(), password, username.trim())
        if (needsConfirmation) {
          setInfo('Kayıt alındı. Giriş yapmadan önce e-postana gelen doğrulama bağlantısına tıkla.')
          setMode('login')
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Beklenmeyen bir hata oluştu.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-slate-800/60 p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-lg font-black text-slate-950">
            ₺
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">Piyasa Akademi</span>
        </div>

        <div className="max-w-lg">
          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-4xl font-semibold leading-tight tracking-tight text-white"
          >
            10.000 ₺ sanal sermaye.
            <br />
            <span className="text-emerald-400">Gerçek piyasa refleksleri.</span>
          </motion.h1>
          <p className="mt-5 text-base leading-relaxed text-slate-400">
            Petrol şokundan faiz kararına kadar makro olayları portföyünde hissederek öğren. Riski bedava
            al: para sanal, ders gerçek.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-4">
            {[
              { label: 'Başlangıç bakiyesi', value: '10.000 ₺' },
              { label: 'Varlık', value: '19' },
              { label: 'Kriz senaryosu', value: '4' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-800/70 bg-slate-900/40 p-3">
                <dt className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{item.label}</dt>
                <dd className="mt-1 text-lg font-semibold text-white">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-xs text-slate-600">
          Sanal para ile oynanan eğitim simülasyonu. Yatırım tavsiyesi değildir.
        </p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
          <div className="mb-6 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500 text-lg font-black text-slate-950">
              ₺
            </span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {mode === 'login' ? 'Tekrar hoş geldin' : 'Oyuncu hesabı oluştur'}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {mode === 'login'
              ? 'Portföyüne kaldığın yerden devam et.'
              : 'Kullanıcı adın liderlik tablosunda görünecek.'}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            {(['login', 'register'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setMode(item)
                  setError(null)
                  setInfo(null)
                }}
                className={[
                  'rounded-lg py-2 text-sm font-medium transition',
                  mode === item ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200',
                ].join(' ')}
              >
                {item === 'login' ? 'Giriş yap' : 'Kayıt ol'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'register' ? (
              <Field label="Kullanıcı adı">
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  minLength={3}
                  maxLength={24}
                  autoComplete="nickname"
                  placeholder="ornek_oyuncu"
                  className="input"
                />
              </Field>
            ) : null}

            <Field label="E-posta">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="ornek@mail.com"
                className="input"
              />
            </Field>

            <Field label="Şifre">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                className="input"
              />
            </Field>

            {error ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {error}
              </p>
            ) : null}

            {info ? (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                {info}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? 'İşleniyor…' : mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-600">
            Devam ederek sanal para ile oynanan bir eğitim simülasyonuna katıldığını kabul edersin.
          </p>
        </motion.div>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-400">{label}</span>
      {children}
    </label>
  )
}
