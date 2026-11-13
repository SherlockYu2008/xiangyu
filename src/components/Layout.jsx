import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import Icon, { Mark } from './Icon'
import { Avatar } from './ui'
import { ReadProgress } from './FX'
import { BRAND } from '../lib/brand'
import { pendingRequests, unreadTotal, isAdmin, useStore } from '../lib/store'

const NAV = [
  { to: '/', label: '首页', icon: 'home', end: true },
  { to: '/friends', label: '朋友', icon: 'friends' },
  { to: '/materials', label: '资料库', icon: 'book' },
  { to: '/albums', label: '相册', icon: 'image' },
  { to: '/diary', label: '日志', icon: 'file' },
  { to: '/circles', label: '兴趣圈', icon: 'grid' },
  { to: '/match', label: '同频匹配', icon: 'sparkles' },
  { to: '/messages', label: '消息', icon: 'chat' },
  { to: '/me', label: '我的', icon: 'user' },
]

const MOBILE_NAV = [
  { to: '/', label: '首页', icon: 'home', end: true },
  { to: '/friends', label: '朋友', icon: 'friends' },
  { to: '/circles', label: '兴趣圈', icon: 'grid' },
  { to: '/messages', label: '消息', icon: 'chat' },
  { to: '/me', label: '我的', icon: 'user' },
]

export default function Layout() {
  const s = useStore()
  const loc = useLocation()
  const unread = unreadTotal(s)
  const requests = pendingRequests(s).length

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [loc.pathname])

  const badgeFor = (to) => (to === '/messages' ? unread + requests : 0)
  const nav = isAdmin(s) ? [...NAV, { to: '/admin', label: '管理', icon: 'shield' }] : NAV

  return (
    <div className="shell">
      <div className="ambient" aria-hidden="true" />
      <ReadProgress />
      <aside className="side">
        <Link to="/" className="side__brand">
          <Mark size={38} />
          <span className="side__brandtxt">
            <strong>{BRAND.name}</strong>
            <em>{BRAND.latin}</em>
          </span>
        </Link>

        <nav className="side__nav">
          {nav.map((item) => {
            const n = badgeFor(item.to)
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `navitem ${isActive ? 'is-active' : ''}`}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
                {n > 0 && <b className="navitem__dot">{n > 99 ? '99+' : n}</b>}
              </NavLink>
            )
          })}
        </nav>

        <div className="side__foot">
          <div className="side__ai">
            <span className="side__ailed">
              <Icon name="shield" size={16} />
            </span>
            <div>
              <b>青岛科技大学</b>
              <span>校内同频 · 学习圈</span>
            </div>
          </div>
          <Link to="/me" className="side__me">
            <Avatar name={s.me?.nickname} seed={s.me?.nickname} size={34} online />
            <div>
              <b>{s.me?.nickname}</b>
              <span>
                {s.me?.grade} · {s.me?.major}
              </span>
            </div>
          </Link>
        </div>
      </aside>

      <main className="main">
        <header className="mbar">
          <Link to="/" className="mbar__brand">
            <Mark size={28} />
            <strong>{BRAND.name}</strong>
          </Link>
          <div className="mbar__right">
            <Link to="/messages" className="icon-btn" aria-label="消息">
              <Icon name="chat" size={19} />
              {unread + requests > 0 && <i className="icon-btn__dot" />}
            </Link>
            <Link to="/me" aria-label="我的">
              <Avatar name={s.me?.nickname} seed={s.me?.nickname} size={30} />
            </Link>
          </div>
        </header>

        <div className="main__inner">
          <Outlet />
        </div>
      </main>

      <nav className="tabbar">
        {MOBILE_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `tabbar__item ${isActive ? 'is-active' : ''}`}
          >
            <Icon name={item.icon} size={21} />
            <span>{item.label}</span>
            {badgeFor(item.to) > 0 && <i className="tabbar__dot" />}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
