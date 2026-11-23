// 橡遇 · 共享后端（零依赖）
// 跑起来：node server/index.mjs
// 打开：http://localhost:8787（同一 WiFi 的同学用你的内网 IP:8787 也能进）
//
// 数据存在 server/data/world.json，密码用 scrypt 加盐摘要，不存明文。
import http from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync, createReadStream, statSync, unlinkSync } from 'node:fs'
import { join, extname, normalize, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto'
import { createOps } from './ops.mjs'

const PORT = Number(process.env.PORT || 8787)
// 用文件自身位置算根目录：从计划任务/快捷方式启动时 cwd 不是项目目录也不会 404
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
// 数据目录可以用 XY_DATA_DIR 指到别处（云端挂载的持久磁盘）
const DATA_DIR = process.env.XY_DATA_DIR ? String(process.env.XY_DATA_DIR) : join(ROOT, 'server', 'data')
const DATA_FILE = join(DATA_DIR, 'world.json')
const UPLOADS = join(DATA_DIR, 'uploads')
const SECRET = process.env.XY_SECRET || 'xiangyu-dev-secret-change-me'
const TOKEN_TTL = 7 * 24 * 3600 * 1000

/* ---------------- 文件落盘 ----------------
   照片和资料都不塞进 world.json，而是解码成文件放在 server/data/uploads/，
   world.json 里只留一条 /uploads/xxx 的地址。 */
const EXT_BY_MIME = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/plain': 'txt',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

function persistFile(dataUrl, name) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return dataUrl
  const m = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(dataUrl)
  if (!m) return dataUrl
  const mime = m[1].toLowerCase()
  const ext = EXT_BY_MIME[mime] || (mime.startsWith('image/') ? 'jpg' : 'bin')
  const file = `${name}.${ext}`

  // 云数据库模式：文件直接存进 world.__files，服务器无状态
  if (useDb) {
    world.__files = world.__files || {}
    world.__files[file] = { mime, b64: m[2] }
    return `/uploads/${file}`
  }

  try {
    mkdirSync(UPLOADS, { recursive: true })
    writeFileSync(join(UPLOADS, file), Buffer.from(m[2], 'base64'))
    return `/uploads/${file}`
  } catch (e) {
    console.error('文件落盘失败：', e.message)
    return dataUrl
  }
}

function persistImage(dataUrl, name) {
  return persistFile(dataUrl, name)
}

function removeImage(url) {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) return
  const file = url.slice('/uploads/'.length)
  if (useDb && world.__files) {
    delete world.__files[file]
    return
  }
  try {
    unlinkSync(join(UPLOADS, file))
  } catch {
    /* 文件可能已经不在了 */
  }
}

const CIRCLES = [
  ['study', '学习考证', '🎓', '学习考证', 'violet', '四级六级、考研期末、教资考证。一个人容易摆烂，一群人能卷起来。', ['四级', '考研', '自习']],
  ['sport', '运动健身', '🏸', '运动健身', 'mint', '羽毛球、夜跑、篮球、健身房。缺人的时候，最需要的就是一个「来」。', ['羽毛球', '夜跑', '篮球']],
  ['art', '文艺生活', '🎸', '文艺生活', 'rose', '吉他、摄影、乐队、读书会。会一点和不会一点的人，都能在这里开个头。', ['吉他', '摄影', '读书']],
  ['tech', '技术极客', '💻', '技术极客', 'blue', '写代码、做开源、打竞赛、搞 AI。青科的实验室和宿舍，都能卷出东西。', ['编程', '开源', '人工智能']],
  ['game', '游戏电竞', '🎮', '游戏电竞', 'amber', '剧本杀、桌游、开黑。五缺一的时候，这个圈子比摇人快。', ['剧本杀', '桌游', '电竞']],
  ['food', '吃喝玩乐', '🍜', '吃喝玩乐', 'orange', '二餐三楼、南门小吃、手冲咖啡。吃饭这件事，两个人比一个人香。', ['美食', '探店', '咖啡']],
  ['outdoor', '户外旅行', '⛰️', '户外旅行', 'teal', '骑行、爬山、露营、看海。崂山就在旁边，周末别只躺宿舍。', ['骑行', '旅行', '爬山']],
  ['volunteer', '志愿公益', '🌱', '志愿公益', 'green', '支教、环保、活动志愿者。想认识点不一样的人，从这里开始。', ['志愿', '公益', '支教']],
].map(([slug, name, emoji, category, tone, desc, tags]) => ({
  slug, name, emoji, category, tone, desc, tags, members: 0,
  rules: '不卖课、不拉私域。约见请在校内公共场合。',
}))

/* ---------------- 存储 ---------------- */

function blankWorld() {
  return {
    users: [], posts: [], albums: [], diaries: [], guestbook: [], visits: [],
    friendPairs: [], requestLog: [], buddies: [], circles: CIRCLES,
    circleMembers: {}, convStore: { conversations: [], messages: {} },
    materials: [],
    announcement: null,
    __files: {},
  }
}

let world = blankWorld()
let saveTimer = null
let useDb = false

/* ---------------- 存储：文件 或 云端数据库 ----------------
   配了 XY_DB_URL + XY_DB_KEY 就把整份数据存进 Supabase/任意 PostgREST：
     建表：create table world (id int primary key, data jsonb, updated_at timestamptz default now());
   这样服务器本身无状态，免费托管重启也不会丢数据。 */
const DB_URL = process.env.XY_DB_URL ? String(process.env.XY_DB_URL).replace(/\/+$/, '') : ''
const DB_KEY = process.env.XY_DB_KEY || ''
useDb = Boolean(DB_URL && DB_KEY)

async function dbLoad() {
  const res = await fetch(`${DB_URL}/rest/v1/world?id=eq.1&select=data`, {
    headers: { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const rows = await res.json()
  return rows?.[0]?.data || null
}

async function dbSave(data) {
  const res = await fetch(`${DB_URL}/rest/v1/world`, {
    method: 'POST',
    headers: {
      apikey: DB_KEY,
      Authorization: `Bearer ${DB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ id: 1, data, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
}

async function initWorld() {
  if (useDb) {
    try {
      const d = await dbLoad()
      if (d) world = { ...blankWorld(), ...d }
      console.log('已从云端数据库读取数据')
    } catch (e) {
      console.error('云端读取失败（用空数据启动）：', e.message)
    }
    return
  }
  try {
    if (existsSync(DATA_FILE)) world = { ...blankWorld(), ...JSON.parse(readFileSync(DATA_FILE, 'utf8')) }
  } catch (e) {
    console.error('读取数据失败，用空数据启动：', e.message)
  }
}

function save() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    if (useDb) {
      try {
        await dbSave(world)
      } catch (e) {
        console.error('云端保存失败：', e.message)
      }
      return
    }
    try {
      mkdirSync(DATA_DIR, { recursive: true })
      writeFileSync(DATA_FILE, JSON.stringify(world))
    } catch (e) {
      console.error('保存失败：', e.message)
    }
  }, 200)
}

/* ---------------- 账号 ---------------- */

const rid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
const pub = (u) => {
  const { pass, ...rest } = u
  return rest
}

function hashPw(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 64).toString('hex')
  return { salt, hash }
}

function sign(uid, exp) {
  const body = `${uid}.${exp}`
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verifyToken(token = '') {
  const [uid, exp, sig] = String(token).split('.')
  if (!uid || !exp || !sig) return null
  const want = createHmac('sha256', SECRET).update(`${uid}.${exp}`).digest('base64url')
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null
  if (Number(exp) < Date.now()) return null
  return world.users.find((u) => u.id === uid) || null
}

function snapshot() {
  return {
    users: world.users.map(pub),
    posts: world.posts,
    // 相册里存的是 /uploads/xxx.jpg，发给前端时统一成 dataUrl 字段，前端不用改
    albums: world.albums.map((a) => ({
      ...a,
      photos: a.photos.map((ph) => ({ ...ph, dataUrl: ph.url || ph.dataUrl })),
    })),
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

/* ---------------- 业务操作 ---------------- */

const isAdmin = (u) => Boolean(u && u.role === 'admin')

// 业务操作从 ops.mjs 引入（两个运行环境共用）
let ops = null

function json(res, code, data) {
  const body = JSON.stringify(data)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 20e6) reject(new Error('too large'))
    })
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', reject)
  })
}

function serveStatic(req, res) {
  let file = normalize(join(DIST, decodeURIComponent((req.url || '/').split('?')[0])))
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end('forbidden')
    return
  }
  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(DIST, 'index.html')
  }
  try {
    const size = statSync(file).size
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Content-Length': size })
    createReadStream(file).pipe(res)
  } catch {
    res.writeHead(404).end('not found')
  }
}

const sseClients = new Set()

function broadcast() {
  for (const client of sseClients) {
    try {
      client.write('event: change\ndata: {}\n\n')
    } catch {
      sseClients.delete(client)
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = (req.url || '/').split('?')[0]

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()

  if (url === '/api/health') return json(res, 200, { ok: true, users: world.users.length })

  // 实时推送：浏览器用 EventSource 连这里，有人改数据就推一条 change
  if (url.startsWith('/api/stream')) {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token') || ''
    const user = verifyToken(token)
    if (!user) return res.writeHead(401).end()
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    })
    res.write(': connected\n\n')
    sseClients.add(res)
    const ping = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        /* ignore */
      }
    }, 25000)
    req.on('close', () => {
      clearInterval(ping)
      sseClients.delete(res)
    })
    return
  }

  // 图片文件：/uploads/xxx.jpg
  if (url.startsWith('/uploads/')) {
    const name = url.slice('/uploads/'.length).replace(/[^a-zA-Z0-9._-]/g, '')

    // 云数据库模式：文件在 world.__files 里
    if (useDb) {
      const f = world.__files?.[name]
      if (!f) return res.writeHead(404).end('not found')
      const buf = Buffer.from(f.b64, 'base64')
      res.writeHead(200, {
        'Content-Type': f.mime || 'application/octet-stream',
        'Content-Length': buf.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
      })
      return res.end(buf)
    }

    const file = normalize(join(UPLOADS, name))
    if (!file.startsWith(UPLOADS)) return res.writeHead(403).end()
    try {
      const size = statSync(file).size
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] || 'image/jpeg',
        'Content-Length': size,
        'Cache-Control': 'public, max-age=31536000, immutable',
      })
      return createReadStream(file).pipe(res)
    } catch {
      return res.writeHead(404).end('not found')
    }
  }

  if (url === '/api/register' && req.method === 'POST') {
    const b = await readBody(req)
    const nickname = String(b.nickname || '').trim()
    const password = String(b.password || '')
    if (nickname.length < 2) return json(res, 400, { ok: false, error: '昵称太短' })
    if (password.length < 8) return json(res, 400, { ok: false, error: '密码至少 8 位' })
    if (world.users.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase())) {
      return json(res, 409, { ok: false, error: '这个昵称已经被注册了' })
    }
    const user = {
      id: rid('u'), nickname, pass: hashPw(password),
      grade: b.grade || '', campus: b.campus || '', major: b.major || '', bio: b.bio || '',
      tags: b.tags || [], studentNo: b.studentNo ? `${b.studentNo.slice(0, 4)}******` : '未填写',
      createdAt: Date.now(), lastLoginAt: Date.now(), online: true,
      // 整台服务器上的第一个账号自动成为管理员
      role: world.users.length === 0 ? 'admin' : 'user',
    }
    world.users.push(user)
    save()
    const exp = Date.now() + TOKEN_TTL
    return json(res, 200, { ok: true, token: sign(user.id, exp), world: snapshot() })
  }

  if (url === '/api/login' && req.method === 'POST') {
    const b = await readBody(req)
    const user = world.users.find((u) => u.nickname.toLowerCase() === String(b.nickname || '').trim().toLowerCase())
    if (!user) return json(res, 401, { ok: false, error: '账号或密码不对' })
    if (user.banned) return json(res, 403, { ok: false, error: '这个账号已被管理员封禁' })
    if (user.lockedUntil && user.lockedUntil > Date.now()) {
      return json(res, 423, { ok: false, error: '密码错误次数太多，已锁定，请稍后再试' })
    }
    const { hash } = hashPw(String(b.password || ''), user.pass.salt)
    if (hash !== user.pass.hash) {
      user.failed = (user.failed || 0) + 1
      if (user.failed >= 5) {
        user.lockedUntil = Date.now() + 5 * 60000
        user.failed = 0
      }
      save()
      return json(res, 401, { ok: false, error: '账号或密码不对' })
    }
    user.failed = 0
    user.lockedUntil = 0
    user.lastLoginAt = Date.now()
    save()
    const exp = Date.now() + TOKEN_TTL
    return json(res, 200, { ok: true, token: sign(user.id, exp), world: snapshot() })
  }

  if (url === '/api/world') {
    const user = verifyToken((req.headers.authorization || '').replace(/^Bearer /, ''))
    if (!user) return json(res, 401, { ok: false, error: '请重新登录' })
    return json(res, 200, { ok: true, world: snapshot(), me: pub(user) })
  }

  if (url === '/api/op' && req.method === 'POST') {
    const user = verifyToken((req.headers.authorization || '').replace(/^Bearer /, ''))
    if (!user) return json(res, 401, { ok: false, error: '请重新登录' })
    const b = await readBody(req)
    const fn = ops[b.type]
    if (!fn) return json(res, 400, { ok: false, error: '未知操作' })
    let extra = {}
    try {
      extra = fn(user, b.payload || {}) || {}
    } catch (e) {
      return json(res, 500, { ok: false, error: e.message })
    }
    save()
    broadcast()
    return json(res, 200, { ok: true, ...extra })
  }

  if (url.startsWith('/api/')) return json(res, 404, { ok: false, error: 'not found' })
  return serveStatic(req, res)
})

// 老数据迁移：把 world.json 里内嵌的 base64 图片搬到 uploads/
function migrateImages() {
  let changed = false
  for (const post of world.posts) {
    post.images = (post.images || []).map((src, i) => {
      if (typeof src === 'string' && src.startsWith('data:')) {
        changed = true
        return persistImage(src, `old_${post.id}_${i}`)
      }
      return src
    })
  }
  for (const album of world.albums) {
    for (const ph of album.photos || []) {
      if (typeof ph.dataUrl === 'string' && ph.dataUrl.startsWith('data:')) {
        ph.url = persistImage(ph.dataUrl, ph.id || rid('ph'))
        delete ph.dataUrl
        changed = true
      }
    }
  }
  if (changed) {
    console.log('已把内嵌图片迁移到 server/data/uploads/')
    save()
  }
}

await initWorld()
migrateImages()
ops = createOps(world, { rid, persistFile, removeImage, isAdmin })

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('')
    console.error(`端口 ${PORT} 已经被占用了：可能已经有一个橡遇在跑。`)
    console.error(`直接打开 http://localhost:${PORT} 试试；如果是重复双击，关掉多余的黑窗口就行。`)
    console.error('')
    process.exit(0)
  }
  throw e
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`橡遇服务已启动：http://localhost:${PORT}`)
  console.log(`数据文件：${DATA_FILE}`)
})
