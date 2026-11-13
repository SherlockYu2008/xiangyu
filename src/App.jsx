import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/ui'
import { useStore } from './lib/store'
import AlbumDetail from './pages/AlbumDetail'
import Admin from './pages/Admin'
import Albums from './pages/Albums'
import Chat from './pages/Chat'
import CircleDetail from './pages/CircleDetail'
import Circles from './pages/Circles'
import Diary from './pages/Diary'
import DiaryDetail from './pages/DiaryDetail'
import Friends from './pages/Friends'
import Home from './pages/Home'
import Match from './pages/Match'
import Materials from './pages/Materials'
import Me from './pages/Me'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import Welcome from './pages/Welcome'

function RequireMe({ children }) {
  const s = useStore()
  return s.me ? children : <Navigate to="/welcome" replace />
}

function WelcomeRoute() {
  const s = useStore()
  return s.me ? <Navigate to="/" replace /> : <Welcome />
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Routes>
          <Route path="/welcome" element={<WelcomeRoute />} />
          <Route
            element={
              <RequireMe>
                <Layout />
              </RequireMe>
            }
          >
            <Route path="/" element={<Home />} />
            <Route path="/u/:id" element={<Profile />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/albums" element={<Albums />} />
            <Route path="/albums/:id" element={<AlbumDetail />} />
            <Route path="/diary" element={<Diary />} />
            <Route path="/diary/:id" element={<DiaryDetail />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/circles" element={<Circles />} />
            <Route path="/circles/:slug" element={<CircleDetail />} />
            <Route path="/discover" element={<Navigate to="/friends" replace />} />
            <Route path="/match" element={<Match />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/messages/:id" element={<Chat />} />
            <Route path="/me" element={<Me />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </HashRouter>
  )
}
