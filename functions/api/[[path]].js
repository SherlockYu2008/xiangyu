// 橡遇 · Cloudflare Pages Functions 后端
// 与 server/index.mjs 共用业务逻辑（server/ops.mjs），数据存 KV。
// 绑定：KV 命名空间必须命名为 WORLD；环境变量 XY_SECRET 用于签发登录令牌。
import { createOps } from '../../server/ops.mjs'

const TOKEN_TTL = 7 * 24 * 3600 * 1000
// Cloudflare 免费版每次请求只有 10ms CPU，PBKDF2 迭代次数必须压到很低
// （浏览器端仍用 12 万次；这里是服务端存储，演示够用）
const PBKDF2_ITER = 1000
const enc = new TextEncoder()

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

const rid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const CIRCLES = [
  ['study', '学习考证', '🎓', '学习考证', 'violet', '四级六级、考研期末、教资考证。一个人容易摆烂，一群人能卷起来。', ['四级', '考研', '自习']],
  ['sport', '运动健身', '🏸', '运动健身', 'mint', '羽毛球、夜跑、篮球、健身房。缺人的时候，最需要的就是一个「来」。', ['羽毛球', '夜跑', '篮球']],
  ['art', '文艺生活', '🎸', '文艺生活', 'rose', '吉他、摄影、乐队、读书会。会一点和不会一点的人，都能在这里开个头。', ['吉他', '摄影', '读书']],
  ['tech', '技术极客', '💻', '技术极客', 'blue', '写代码、做开源、打竞赛、搞 AI。青科的实验室和宿舍，都能卷出东西。', ['编程', '开源', '人工智能']],
  ['game', '游戏开黑', '🎮', '游戏开黑', 'amber', '五排缺人、双排上分、周末桌游。室友不玩也不耽误你开黑。', ['英雄联盟', '桌游', '手游']],
  ['life', '校园生活', '🍜', '校园生活', 'mint', '探店、食堂测评、二手好物、失物招领。', ['食堂', '二手', '探店']],
  ['career', '考研就业', '📄', '考研就业', 'blue', '简历互改、面试模拟、保研经验、实习内推。', ['实习', '保研', '简历']],
  ['outdoor', '户外旅行', '🏕️', '户外旅行', 'rose', '爬山、露营、骑行、看海。青岛的山和海，别一个人去。', ['爬山', '露营', '骑行']],
].map(([slug, name, emoji, tag, tone, desc, tags]) => ({ slug, name, emoji, tag, tone, desc, tags, members: 0 }))

function blankWorld() {
  return {
    users: [], posts: [], albums: [], diaries: [], guestbook: [], visits: [],
    friendPairs: [], requestLog: [], buddies: [], circles: CIRCLES,
    circleMembers: {}, convStore: { conversations: [], messages: {} },
    materials: [], announcement: null, __files: {},
  }
}

async function loadWorld(env) {
  const raw = await env.WORLD.get('world')
  if (!raw) return blankWorld()
  try {
    return { ...blankWorld(), ...JSON.parse(raw) }
  } catch {
    return blankWorld()
  }
}

const saveWorld = (env, world) => env.WORLD.put('world', JSON.stringify(world))

function snapshot(world) {
  return {
    users: world.users.map((u) => {
      const { pass, ...rest } = u
      return rest
    }),
    posts: world.posts,
    albums: world.albums,
    diaries: world.diaries,
    guestbook: world.guestbook,
    visits: world.visits,
    friendPairs: world.friendPairs,
    requestLog: world.requestLog,
    buddies: world.buddies,
    circles: world.circles,
    circleMembers: world.circleMembers,
    announcement: world.announcement || null,
    materials: world.materials || [],
    convStore: world.convStore,
  }
}

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function hashPw(password, salt) {
  const s = salt || hex(crypto.getRandomValues(new Uint8Array(16)))
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(s), iterations: PBKDF2_ITER, hash: 'SHA-256' },
    key,
    256,
  )
  return { hash: hex(bits), salt: s }
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const sign = async (uid, exp, secret) => `${uid}.${exp}.${await hmac(`${uid}.${exp}`, secret)}`

async function verify(token, world, secret) {
  if (!token) return null
  const [uid, exp, sig] = token.split('.')
  if (!uid || !exp || !sig) return null
  if (Number(exp) < Date.now()) return null
  const expect = await hmac(`${uid}.${exp}`, secret)
  if (sig !== expect) return null
  return world.users.find((u) => u.id === uid) || null
}

const bearer = (req) => {
  const h = req.headers.get('authorization') || ''
  return h.startsWith('Bearer ') ? h.slice(7) : ''
}

const EXT = (mime) => {
  const map = {
    'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
    'image/gif': 'gif', 'text/plain': 'txt', 'application/zip': 'zip',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  }
  return map[mime] || (mime.startsWith('image/') ? 'jpg' : 'bin')
}

export async function onRequest(context) {
  try {
    return await handle(context)
  } catch (e) {
    return json({ ok: false, error: String(e && e.message ? e.message : e) }, 500)
  }
}

async function handle(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname
  const secret = env.XY_SECRET || 'xiangyu-dev-secret-change-me'

  if (!env.WORLD) return json({ ok: false, error: '缺少 KV 绑定 WORLD' }, 500)

  if (path === '/api/health') {
    const world = await loadWorld(env)
    return json({ ok: true, users: world.users.length })
  }

  // 实时通道：Pages 上不支持长连接，返回 204，前端自动退回轮询
  if (path === '/api/stream') return new Response(null, { status: 204 })

  if (path === '/api/register' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}))
    const nickname = String(b.nickname || '').trim()
    const password = String(b.password || '')
    if (nickname.length < 2) return json({ ok: false, error: '昵称太短' }, 400)
    if (password.length < 8) return json({ ok: false, error: '密码至少 8 位' }, 400)
    const world = await loadWorld(env)
    if (world.users.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase())) {
      return json({ ok: false, error: '这个昵称已经被注册了' }, 409)
    }
    const user = {
      id: rid('u'),
      nickname,
      pass: await hashPw(password),
      grade: b.grade || '',
      campus: b.campus || '',
      major: b.major || '',
      bio: b.bio || '',
      tags: b.tags || [],
      studentNo: b.studentNo ? `${b.studentNo.slice(0, 4)}******` : '未填写',
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      online: true,
      role: world.users.length === 0 ? 'admin' : 'user',
    }
    world.users.push(user)
    await saveWorld(env, world)
    const exp = Date.now() + TOKEN_TTL
    return json({ ok: true, token: await sign(user.id, exp, secret), world: snapshot(world) })
  }

  if (path === '/api/login' && request.method === 'POST') {
    const b = await request.json().catch(() => ({}))
    const world = await loadWorld(env)
    const user = world.users.find((u) => u.nickname.toLowerCase() === String(b.nickname || '').trim().toLowerCase())
    if (!user) return json({ ok: false, error: '账号或密码不对' }, 401)
    if (user.banned) return json({ ok: false, error: '这个账号已被管理员封禁' }, 403)
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      return json({ ok: false, error: '密码错误次数太多，已锁定，请稍后再试' }, 423)
    }
    const { hash } = await hashPw(String(b.password || ''), user.pass.salt)
    if (hash !== user.pass.hash) {
      user.failed = (user.failed || 0) + 1
      if (user.failed >= 5) {
        user.lockedUntil = Date.now() + 5 * 60000
        user.failed = 0
      }
      await saveWorld(env, world)
      return json({ ok: false, error: '账号或密码不对' }, 401)
    }
    user.failed = 0
    user.lockedUntil = 0
    user.lastLoginAt = Date.now()
    await saveWorld(env, world)
    const exp = Date.now() + TOKEN_TTL
    return json({ ok: true, token: await sign(user.id, exp, secret), world: snapshot(world) })
  }

  if (path === '/api/world') {
    const world = await loadWorld(env)
    const user = await verify(bearer(request), world, secret)
    if (!user) return json({ ok: false, error: '请重新登录' }, 401)
    const { pass, ...me } = user
    return json({ ok: true, world: snapshot(world), me })
  }

  if (path === '/api/op' && request.method === 'POST') {
    const world = await loadWorld(env)
    const user = await verify(bearer(request), world, secret)
    if (!user) return json({ ok: false, error: '请重新登录' }, 401)
    const b = await request.json().catch(() => ({}))

    const ops = createOps(world, {
      rid,
      removeImage: (u) => {
        if (typeof u === 'string' && u.startsWith('/uploads/')) delete world.__files[u.slice('/uploads/'.length)]
      },
      persistFile: (dataUrl, name) => {
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl
        const m = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(dataUrl)
        if (!m) return dataUrl
        const mime = m[1].toLowerCase()
        const file = `${name}.${EXT(mime)}`
        world.__files = world.__files || {}
        world.__files[file] = { mime, b64: m[2] }
        return `/uploads/${file}`
      },
      isAdmin: (u) => Boolean(u && u.role === 'admin'),
    })

    const fn = ops[b.type]
    if (!fn) return json({ ok: false, error: '未知操作' }, 400)
    let extra = {}
    try {
      extra = fn(user, b.payload || {}) || {}
    } catch (e) {
      return json({ ok: false, error: e.message }, 500)
    }
    await saveWorld(env, world)
    return json({ ok: true, ...extra })
  }

  return json({ ok: false, error: '接口不存在' }, 404)
}
