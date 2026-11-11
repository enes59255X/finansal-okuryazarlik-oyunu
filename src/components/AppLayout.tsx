import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { formatTRY } from '../lib/format'

const links = [
  { to: '/', label: 'Piyasa', end: true },
  { to: '/portfolio', label: 'Portföy', end: false },
  { to: '/leaderboard', label: 'Liderlik', end: false },
]

export function AppLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-800/70 bg-[#070b12]/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500 text-sm font-black text-slate-950">
              ₺
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
              Piyasa Akademi
            </span>
          </NavLink>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-slate-800/80 text-white'
                      : 'text-slate-400 hover:bg-slate-800/40 hover:text-slate-200',
                  ].join(' ')
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Nakit</p>
              <p className="tabular-nums text-sm font-semibold text-emerald-300">
                {formatTRY(Number(profile?.cash_balance ?? 0))}
              </p>
            </div>
            <div className="hidden h-8 w-px bg-slate-800 sm:block" />
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-200">{profile?.username}</p>
              <button
                type="button"
                onClick={handleSignOut}
                className="text-[11px] text-slate-500 transition hover:text-rose-300"
              >
                Çıkış yap
              </button>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-rose-400/50 hover:text-rose-300 sm:hidden"
            >
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <main className="pb-16">
        <Outlet />
      </main>
    </div>
  )
}
