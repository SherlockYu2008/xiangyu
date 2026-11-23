import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { probe, getToken, world } from './lib/cloud'
import { isRemote } from './lib/remote'
import { adoptCloud, logout, startCloudSync, startRemoteSync } from './lib/store'
import './styles/base.css'
import './styles/pages.css'
import './styles/social.css'
import './styles/fx.css'

// 三种运行模式，按优先级探测：
// 1. 配了 VITE_SB_URL/VITE_SB_KEY → 直连 Supabase（所有人共享一份数据）
// 2. 同域有 /api/health → 自己的 Node 后端（最安全）
// 3. 都没有 → 本机模式，只在这台设备上能用
async function boot() {
  if (isRemote()) {
    try {
      await startRemoteSync()
    } catch (e) {
      console.error('云端同步启动失败：', e.message)
    }
  } else {
    const online = await probe()
    if (online) {
      if (getToken()) {
        const r = await world()
        if (r?.ok) {
          adoptCloud(r.world, r.me?.id)
          startCloudSync(r.me?.id)
        } else {
          logout()
        }
      } else {
        logout()
      }
    }
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
}

boot()
