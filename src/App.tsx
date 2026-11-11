import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ConfigNotice } from './components/ConfigNotice'
import { isSupabaseConfigured } from './lib/supabase'
import { AssetPage } from './pages/AssetPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { LoginPage } from './pages/LoginPage'
import { MarketPage } from './pages/MarketPage'
import { PortfolioPage } from './pages/PortfolioPage'

export default function App() {
  if (!isSupabaseConfigured) return <ConfigNotice />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<MarketPage />} />
          <Route path="asset/:assetId" element={<AssetPage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
