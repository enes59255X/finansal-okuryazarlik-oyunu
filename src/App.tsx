import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ConfigNotice } from './components/ConfigNotice'
import { isSupabaseConfigured } from './lib/supabase'
import { AdminPage } from './pages/AdminPage'
import { AssetPage } from './pages/AssetPage'
import { CasinoPage } from './pages/CasinoPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { LoginPage } from './pages/LoginPage'
import { MarketPage } from './pages/MarketPage'
import { MissionsPage } from './pages/MissionsPage'
import { NewsPage } from './pages/NewsPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SquadPage } from './pages/SquadPage'

export default function App() {
  if (!isSupabaseConfigured) return <ConfigNotice />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<SquadPage />} />
          <Route path="market" element={<MarketPage />} />
          <Route path="squad" element={<Navigate to="/" replace />} />
          <Route path="asset/:assetId" element={<AssetPage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="missions" element={<MissionsPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="casino" element={<CasinoPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route element={<AdminOnly />}>
            <Route path="admin" element={<AdminPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function AdminOnly() {
  const { profile } = useAuth()
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
