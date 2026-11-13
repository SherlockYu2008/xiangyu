import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { probe, getToken, world } from './lib/cloud'
import { adoptCloud, logout, startCloudSync } from './lib/store'
import './styles/base.css'
import './styles/pages.css'
import './styles/social.css'
import './styles/fx.css'

// 先问一句「有没有共享后端」：
// 有 → 从服务器拉数据，大家看到的是同一份；
// 没有 → 退回本机模式，只在这台设备上能用。
async function boot() {
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

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

boot()
