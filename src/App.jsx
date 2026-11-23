import { Suspense, lazy } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './components/ui'
import { useStore } from './lib/store'
import Welcome from './pages/Welcome'

// 首页和欢迎页直接打包，其余页面按需加载：首屏更小、更快
import Home from './pages/Home'

const Profile = lazy(() => import('./pages/Profile'))
const Friends = lazy(() => import('./pages/Friends'))
const Albums = lazy(() => import('./pages/Albums'))
const AlbumDetail = lazy(() => import('./pages/AlbumDetail'))
const Diary = lazy(() => import('./pages/Diary'))
const DiaryDetail = lazy(() => import('./pages/DiaryDetail'))
const Materials = lazy(() => import('./pages/Materials'))
const Circles = lazy(() => import('./pages/Circles'))
const CircleDetail = lazy(() => import('./pages/CircleDetail'))
const Match = lazy(() => import('./pages/Match'))
const Messages = lazy(() => import('./pages/Messages'))
const Chat = lazy(() => import('./pages/Chat'))
const Me = lazy(() => import('./pages/Me'))
const Admin = lazy(() => import('./pages/Admin'))
const About = lazy(() => import('./pages/About'))

function RequireMe({ children }) {
  const s = useStore()
  return s.me ? children : <Navigate to="/welcome" replace />
}

function WelcomeRoute() {
  const s = useStore()
  return s.me ? <Navigate to="/" replace /> : <Welcome />
}

function Loading() {
  return (
    <div className="page">
      <div className="skeleton-page">
        <span className="skeleton skeleton--title" />
        <span className="skeleton skeleton--line" />
        <span className="skeleton skeleton--card" />
        <span className="skeleton skeleton--card" />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <Suspense fallback={<Loading />}>
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
              <Route path="/about" element={<About />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </HashRouter>
  )
}
