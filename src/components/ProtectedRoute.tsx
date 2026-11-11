import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

export function ProtectedRoute() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/60 p-8 text-center">
          <h2 className="text-lg font-semibold text-white">Profil hazırlanıyor</h2>
          <p className="mt-2 text-sm text-slate-400">
            Hesabın oluşturuldu ama oyuncu profili henüz yüklenemedi. Sayfayı yenilemeyi dene.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Yenile
          </button>
        </div>
      </div>
    )
  }

  return <Outlet />
}
