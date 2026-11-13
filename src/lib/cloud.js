// 共享后端客户端：探到 /api/health 就把数据放到服务器上，否则退回本机模式。
const TOKEN_KEY = 'xiangyu.token'

let base = ''
let enabled = false
let token = ''
try {
  token = localStorage.getItem(TOKEN_KEY) || ''
} catch {
  /* ignore */
}

export const isCloud = () => enabled
export const getToken = () => token

export function setToken(t) {
  token = t || ''
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

async function call(path, body) {
  const res = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    data = { ok: false, error: `服务器返回了 ${res.status}` }
  }
  return { status: res.status, ...data }
}

export async function probe() {
  try {
    const res = await fetch(`${base}/api/health`, { cache: 'no-store' })
    if (!res.ok) return false
    const data = await res.json()
    enabled = Boolean(data.ok)
    return enabled
  } catch {
    enabled = false
    return false
  }
}

export async function login(nickname, password) {
  const r = await call('/api/login', { nickname, password })
  if (r.ok) setToken(r.token)
  return r
}

export async function register(input) {
  const r = await call('/api/register', input)
  if (r.ok) setToken(r.token)
  return r
}

export async function world() {
  if (!token) return null
  const r = await call('/api/world')
  return r.ok ? r : null
}

// 后台推送，失败不打断界面
export function op(type, payload) {
  if (!enabled || !token) return
  call('/api/op', { type, payload }).catch(() => {})
}

export function logoutCloud() {
  setToken('')
}
