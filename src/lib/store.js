// 本机账号 + 本机数据。
// 没有任何示例用户：users 里只有真实注册过的人。
// 每个账号的聊天、圈子、设置、AI 额度都是分开存的，共用一台电脑也不会串。
import { useSyncExternalStore } from 'react'
import { blankState } from './data.js'
import { hashPassword, randomSalt, strongPassword } from './auth.js'
import { todayKey } from './time.js'
import * as cloud from './cloud.js'

const KEY = 'xiangyu.state.v2'

const publicOf = (u) => {
  const { password, ...rest } = u
  return rest
}

const maskStudentNo = (no) => (no.length > 4 ? `${no.slice(0, 4)}******` : '****')

// 把「当前登录的人」相关的数据投影出来，页面只读这些派生字段
function sync(s) {
  const uid = s.sessionId
  const me = uid ? s.users.find((u) => u.id === uid) || null : null
  const convStore = s.convStore || { conversations: [], messages: {} }
  const mine = uid ? convStore.conversations.filter((c) => c.members.includes(uid)) : []
  return {
    ...s,
    convStore,
    me,
    people: s.users.filter((u) => u.id !== uid).map(publicOf),
    conversations: mine.map((c) => ({
      ...c,
      peerId: c.members.find((m) => m !== uid),
      unread: (c.unread && c.unread[uid]) || 0,
    })),
    messages: Object.fromEntries(mine.map((c) => [c.id, convStore.messages[c.id] || []])),
    myCircles: (uid && s.circleMembers[uid]) || [],
    friends: s.friendPairs
      .filter((p) => p.a === uid || p.b === uid)
      .map((p) => (p.a === uid ? p.b : p.a)),
    requests: s.requestLog.filter((r) => r.fromId === uid || r.toId === uid),
    ai: (uid && s.aiByUser[uid]) || { date: todayKey(), used: 0 },
    settings: (uid && s.settingsByUser[uid]) || { searchable: true, allowRandom: true },
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return sync(blankState())
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== 2) return sync(blankState())
    const base = { ...blankState(), ...parsed }
    if (base.sessionId && !base.users.some((u) => u.id === base.sessionId)) base.sessionId = null
    // 会话过期：换电脑/长时间不用都要重新登录
    if (base.sessionId && base.sessionExpiresAt && base.sessionExpiresAt < Date.now()) {
      base.sessionId = null
      base.sessionExpiresAt = 0
    }
    // 本机模式：这台设备上只有一个账号时，它就是管理员（老账号也能补上这个身份）
    if (base.users.length === 1 && !base.users[0].role) {
      base.users[0].role = 'admin'
      try {
        localStorage.setItem(KEY, JSON.stringify(sync(base)))
      } catch {
        /* ignore */
      }
    }
    return sync(base)
  } catch {
    return sync(blankState())
  }
}

let state = load()
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 无痕模式下写不进去，忽略 */
  }
}

export function getState() {
  return state
}

export function setState(patch) {
  const prev = state
  const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch }
  if (!next || next === state) return
  state = sync(next)
  persist()
  if (cloud.isCloud() && !applyingRemote) pushDiff(prev, state)
  listeners.forEach((fn) => fn())
}

/* ---------------- 云端推送：本地改完之后，把差异翻译成服务端操作 ----------------
   两个坑：
   1. 服务器快照拉回来时不能再推一遍，否则会「自己复制自己」（相册无限增殖）。
   2. 同一对象只推一次，避免轮询回来后重复发送。
   -------------------------------------------------------------------------- */

let applyingRemote = false
const sentOnce = new Set()
const once = (key) => {
  if (sentOnce.has(key)) return false
  sentOnce.add(key)
  if (sentOnce.size > 2000) sentOnce.clear()
  return true
}

const changed = (prev, next, pick) => pick(prev) !== pick(next)

function pushDiff(prev, next) {
  const uid = next.sessionId
  if (!uid) return
  const idSet = (arr = []) => new Map(arr.map((x) => [x.id, x]))

  // 动态 + 赞 + 评论
  if (changed(prev, next, (s) => s.posts)) {
    const before = idSet(prev.posts)
    for (const post of next.posts) {
      const old = before.get(post.id)
      if (!old) {
        if (post.authorId === uid && once(`p:${post.id}`)) cloud.op('post.create', { post })
        continue
      }
      const likedBefore = old.likes.includes(uid)
      const likedNow = post.likes.includes(uid)
      if (likedBefore !== likedNow) cloud.op('post.like', { id: post.id })
      for (const c of post.comments) {
        if (!old.comments.some((x) => x.id === c.id) && c.from === uid && once(`cm:${c.id}`)) {
          cloud.op('post.comment', { id: post.id, comment: { id: c.id, text: c.text } })
        }
      }
    }
    for (const old of prev.posts) {
      if (!next.posts.some((p) => p.id === old.id)) cloud.op('post.delete', { id: old.id })
    }
  }

  // 日志
  if (changed(prev, next, (s) => s.diaries)) {
    const before = idSet(prev.diaries)
    const nextIds = new Set(next.diaries.map((d) => d.id))
    for (const oldD of prev.diaries) {
      if (!nextIds.has(oldD.id) && oldD.authorId === uid) cloud.op('diary.delete', { id: oldD.id })
    }
    for (const d of next.diaries) {
      if (!before.has(d.id) && d.authorId === uid && once(`d:${d.id}`)) {
        cloud.op('diary.create', { diary: { id: d.id, title: d.title, body: d.body } })
      }
    }
  }

  // 相册（含删除：本地删了必须告诉服务器，否则下一轮轮询会把它拉回来）
  if (changed(prev, next, (s) => s.albums)) {
    const before = idSet(prev.albums)
    const nextAlbumIds = new Set(next.albums.map((a) => a.id))
    for (const oldA of prev.albums) {
      if (!nextAlbumIds.has(oldA.id) && oldA.ownerId === uid) cloud.op('album.delete', { id: oldA.id })
    }
    for (const a of next.albums) {
      const old = before.get(a.id)
      if (!old) {
        if (a.ownerId === uid && once(`al:${a.id}`)) cloud.op('album.create', { id: a.id, name: a.name })
        continue
      }
      const nextPhotoIds = new Set(a.photos.map((p) => p.id))
      for (const oldPh of old.photos) {
        if (!nextPhotoIds.has(oldPh.id)) cloud.op('album.photo.delete', { albumId: a.id, photoId: oldPh.id })
      }
      for (const ph of a.photos) {
        if (!old.photos.some((x) => x.id === ph.id) && once(`ph:${ph.id}`)) {
          cloud.op('album.photo', {
            albumId: a.id,
            photo: { id: ph.id, dataUrl: ph.dataUrl, caption: ph.caption },
          })
        }
      }
    }
  }

  // 留言 / 访客
  if (changed(prev, next, (s) => s.guestbook)) {
    const before = new Set(prev.guestbook.map((g) => g.id))
    const nextGb = new Set(next.guestbook.map((g) => g.id))
    for (const oldG of prev.guestbook) {
      if (!nextGb.has(oldG.id) && (oldG.fromId === uid || oldG.hostId === uid)) {
        cloud.op('guestbook.delete', { id: oldG.id })
      }
    }
    for (const g of next.guestbook) {
      if (!before.has(g.id) && g.fromId === uid && once(`g:${g.id}`)) {
        cloud.op('guestbook.write', { id: g.id, hostId: g.hostId, text: g.text })
      }
    }
  }
  if (changed(prev, next, (s) => s.visits)) {
    const before = new Set(prev.visits.map((v) => `${v.hostId}:${v.visitorId}`))
    for (const v of next.visits) {
      if (!before.has(`${v.hostId}:${v.visitorId}`) && v.visitorId === uid) cloud.op('visit', { hostId: v.hostId })
    }
  }

  // 学习资料
  if (changed(prev, next, (s) => s.materials)) {
    const before = idSet(prev.materials)
    const nextIds = new Set(next.materials.map((m) => m.id))
    for (const old of prev.materials) {
      if (!nextIds.has(old.id)) cloud.op('material.delete', { id: old.id })
    }
    for (const m of next.materials) {
      if (!before.has(m.id) && m.ownerId === uid && once(`mat:${m.id}`)) {
        cloud.op('material.create', {
          material: {
            id: m.id,
            title: m.title,
            course: m.course,
            desc: m.desc,
            size: m.size,
            fileName: m.fileName,
            dataUrl: m.dataUrl,
          },
        })
      }
    }
  }

  // 好友
  if (changed(prev, next, (s) => s.requests)) {
    const before = new Map(prev.requests.map((r) => [r.id, r]))
    for (const r of next.requests) {
      const old = before.get(r.id)
      if (!old) {
        if (r.fromId === uid && once(`r:${r.id}`)) {
          cloud.op('friend.request', { id: r.id, toId: r.toId, note: r.note })
        }
      } else if (old.status !== r.status && r.status === 'accepted' && r.toId === uid) {
        cloud.op('friend.accept', { id: r.id })
      }
    }
  }
  if (changed(prev, next, (s) => s.friends)) {
    for (const fid of prev.friends) {
      if (!next.friends.includes(fid)) cloud.op('friend.remove', { peerId: fid })
    }
  }

  // 私信
  if (changed(prev, next, (s) => s.messages)) {
    for (const conv of next.conversations) {
      const old = prev.messages[conv.id] || []
      const now = next.messages[conv.id] || []
      if (now.length > old.length) {
        const last = now[now.length - 1]
        if (last.from === uid && once(`m:${last.id}`)) {
          cloud.op('chat.send', { convId: conv.id, message: { id: last.id, body: last.body } })
        }
      }
    }
  }
  if (changed(prev, next, (s) => s.conversations)) {
    const before = new Set(prev.conversations.map((c) => c.id))
    for (const c of next.conversations) {
      if (!before.has(c.id) && c.peerId && once(`c:${c.id}`)) {
        cloud.op('chat.start', { id: c.id, peerId: c.peerId })
      }
      const oldUnread = prev.conversations.find((x) => x.id === c.id)?.unread || 0
      if (c.unread === 0 && oldUnread > 0) cloud.op('chat.read', { convId: c.id })
    }
  }

  // 搭子 / 圈子
  if (changed(prev, next, (s) => s.buddies)) {
    const before = idSet(prev.buddies)
    for (const b of next.buddies) {
      const old = before.get(b.id)
      if (!old) {
        if (b.author === uid && once(`b:${b.id}`)) {
          cloud.op('buddy.create', {
            id: b.id, circle: b.circle, title: b.title, time: b.time, place: b.place,
            capacity: b.capacity, tags: b.tags, intro: b.intro,
          })
        }
        continue
      }
      const joined = b.members.includes(uid)
      const wasJoined = old.members.includes(uid)
      if (!wasJoined && joined) cloud.op('buddy.join', { id: b.id })
      if (wasJoined && !joined) cloud.op('buddy.leave', { id: b.id })
    }
  }
  if (changed(prev, next, (s) => s.myCircles)) {
    for (const slug of next.myCircles) if (!prev.myCircles.includes(slug)) cloud.op('circle.join', { slug })
    for (const slug of prev.myCircles) if (!next.myCircles.includes(slug)) cloud.op('circle.leave', { slug })
  }

  // 资料
  if (changed(prev, next, (s) => s.me) && next.me) {
    cloud.op('profile.update', {
      patch: {
        nickname: next.me.nickname, grade: next.me.grade, campus: next.me.campus,
        major: next.me.major, bio: next.me.bio, tags: next.me.tags,
      },
    })
  }
}

/* ---------------- 云端快照：把服务器数据搬进本地状态 ---------------- */

export function adoptCloud(worldData, meId) {
  const base = blankState()
  applyingRemote = true
  try {
    setState((s) =>
      sync({
        ...base,
        ...s,
        users: worldData.users || [],
        posts: worldData.posts || [],
        albums: worldData.albums || [],
        diaries: worldData.diaries || [],
        materials: worldData.materials || [],
        guestbook: worldData.guestbook || [],
        visits: worldData.visits || [],
        friendPairs: worldData.friendPairs || [],
        requestLog: worldData.requestLog || [],
        buddies: worldData.buddies || [],
        circles: worldData.circles?.length ? worldData.circles : base.circles,
        circleMembers: worldData.circleMembers || {},
        convStore: worldData.convStore || { conversations: [], messages: {} },
        announcement: worldData.announcement || null,
        sessionId: meId || s.sessionId,
        sessionExpiresAt: Date.now() + 7 * 24 * 3600 * 1000,
      }),
    )
  } finally {
    applyingRemote = false
  }
}

let syncTimer = null
let unsubStream = null

export function startCloudSync(meId) {
  if (!cloud.isCloud()) return
  clearInterval(syncTimer)

  const pull = async () => {
    const r = await cloud.world()
    if (r?.ok) adoptCloud(r.world, meId || getState().sessionId)
  }

  // 实时通道：服务器有人改数据就立刻拉一次（正常情况下一两秒内就能看到）
  if (unsubStream) unsubStream()
  unsubStream = cloud.subscribe(pull)

  // 兜底轮询：SSE 被代理挡掉时也不至于完全不动
  syncTimer = setInterval(pull, 8000)
}

export function stopCloudSync() {
  clearInterval(syncTimer)
  if (unsubStream) {
    unsubStream()
    unsubStream = null
  }
}


function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useStore() {
  return useSyncExternalStore(subscribe, getState, getState)
}

/* ---------------- 查询工具 ---------------- */

export function personById(s, id) {
  if (!id) return null
  if (s.me && id === s.me.id) return s.me
  return s.people.find((p) => p.id === id) || null
}

export const circleBySlug = (s, slug) => s.circles.find((c) => c.slug === slug)
export const buddyById = (s, id) => s.buddies.find((b) => b.id === id)
export const unreadTotal = (s) => s.conversations.reduce((n, c) => n + (c.unread || 0), 0)
export const pendingRequests = (s) => s.requests.filter((r) => r.status === 'pending' && r.fromId !== s.me?.id)
export const myBuddies = (s) => (s.me ? s.buddies.filter((b) => b.members.includes(s.me.id)) : [])
export const isMine = (s, id) => Boolean(s.me && id === s.me.id)
export const isAdmin = (s) => s.me?.role === 'admin'

/* ---------------- 管理员操作 ---------------- */

export function adminDeletePost(id) {
  setState((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id) }))
  cloud.op('admin.post.delete', { id })
}

export function adminPinPost(id, pinned) {
  setState((s) => ({ ...s, posts: s.posts.map((p) => (p.id === id ? { ...p, pinned } : p)) }))
  cloud.op('admin.post.pin', { id, pinned })
}

export function adminDeleteAlbum(id) {
  setState((s) => ({ ...s, albums: s.albums.filter((a) => a.id !== id) }))
  cloud.op('admin.album.delete', { id })
}

export function adminDeleteDiary(id) {
  setState((s) => ({ ...s, diaries: s.diaries.filter((d) => d.id !== id) }))
  cloud.op('admin.diary.delete', { id })
}

export function adminDeleteComment(postId, commentId) {
  setState((s) => ({
    ...s,
    posts: s.posts.map((p) =>
      p.id === postId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p,
    ),
  }))
  cloud.op('admin.comment.delete', { postId, commentId })
}

export function adminBanUser(id) {
  setState((s) => ({
    ...s,
    users: s.users.map((u) => (u.id === id ? { ...u, banned: true } : u)),
  }))
  cloud.op('admin.user.ban', { id })
}

export function adminUnbanUser(id) {
  setState((s) => ({
    ...s,
    users: s.users.map((u) => (u.id === id ? { ...u, banned: false } : u)),
  }))
  cloud.op('admin.user.unban', { id })
}

export function adminSetRole(id, role) {
  setState((s) => ({
    ...s,
    users: s.users.map((u) => (u.id === id ? { ...u, role } : u)),
  }))
  cloud.op('admin.role', { id, role })
}

export function adminAnnounce(text) {
  const clean = String(text || '').trim()
  setState((s) => ({
    ...s,
    announcement: clean ? { text: clean.slice(0, 120), at: Date.now(), by: s.me?.nickname } : null,
  }))
  cloud.op('admin.announce', { text: clean })
}

/* ---------------- 注册 / 登录 ---------------- */

export async function register(input) {
  const s = getState()
  const nickname = String(input.nickname || '').trim()

  if (cloud.isCloud()) {
    const r = await cloud.register({
      nickname,
      password: input.password,
      grade: input.grade,
      campus: input.campus,
      major: input.major,
      bio: input.bio,
      tags: input.tags,
      studentNo: input.studentNo || '',
    })
    if (!r.ok) return { ok: false, error: r.error || '注册失败' }
    const me = r.world.users.find((u) => u.nickname.toLowerCase() === nickname.toLowerCase())
    adoptCloud(r.world, me?.id)
    startCloudSync(me?.id)
    return { ok: true, user: me }
  }

  if (nickname.length < 2 || nickname.length > 20) return { ok: false, error: '昵称要 2–20 个字' }
  if (s.users.some((u) => u.nickname.toLowerCase() === nickname.toLowerCase())) {
    return { ok: false, error: '这个昵称在这台设备上已经注册过了，换一个或者直接登录' }
  }
  if (s.users.length >= 20) {
    return { ok: false, error: '这台设备最多存 20 个账号，先让同学用自己的手机注册吧' }
  }
  const pwErr = strongPassword(input.password, { nickname, studentNo: input.studentNo || '' })
  if (pwErr) return { ok: false, error: pwErr }

  const salt = randomSalt()
  const { hash, algo } = await hashPassword(input.password, salt)
  const id = `u_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

  const user = {
    id,
    nickname,
    password: { salt, hash, algo },
    grade: input.grade,
    campus: input.campus,
    major: input.major,
    bio: input.bio,
    tags: input.tags,
    topics: input.topics || [],
    style: input.style || '随缘',
    depth: input.depth || 3,
    lookingFor: input.lookingFor || '',
    studentNo: input.studentNo ? maskStudentNo(input.studentNo) : '未填写',
    createdAt: Date.now(),
    online: true,
    // 本机模式：这台设备上的第一个账号自动成为管理员
    role: s.users.length === 0 ? 'admin' : 'user',
    security: { failed: 0, lockedUntil: 0, lastLoginAt: 0, lastLoginDevice: '' },
  }

  setState((st) =>
    sync({
      ...st,
      users: [...st.users, user],
      sessionId: id,
      sessionExpiresAt: Date.now() + 7 * DAY,
    }),
  )
  return { ok: true, user }
}

const FAIL_LIMIT = 5
const LOCK_MS = 5 * 60 * 1000
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const deviceOf = () =>
  typeof navigator === 'undefined' ? '' : String(navigator.userAgent || '').slice(0, 90)

export async function login(nickname, password, remember = true) {
  const s = getState()
  const now = Date.now()
  const name = String(nickname || '').trim()
  if (!name) return { ok: false, error: '填一下昵称' }

  if (cloud.isCloud()) {
    const r = await cloud.login(name, password)
    if (!r.ok) return { ok: false, error: r.error || '账号或密码不对' }
    const me = r.world.users.find((u) => u.nickname.toLowerCase() === name.toLowerCase())
    adoptCloud(r.world, me?.id)
    startCloudSync(me?.id)
    return { ok: true }
  }

  const user = s.users.find((u) => u.nickname.toLowerCase() === name.toLowerCase())
  if (!user) return { ok: false, error: '这台设备上没有这个昵称的账号，先去注册' }

  const sec = user.security || {}
  if (sec.lockedUntil && sec.lockedUntil > now) {
    const mins = Math.ceil((sec.lockedUntil - now) / 60000)
    return { ok: false, error: `密码错误次数太多，已锁定，${mins} 分钟后再试` }
  }

  const { hash } = await hashPassword(password, user.password.salt)
  if (hash !== user.password.hash) {
    const failed = (sec.failed || 0) + 1
    const lockedUntil = failed >= FAIL_LIMIT ? now + LOCK_MS : 0
    setState((st) => ({
      ...st,
      users: st.users.map((u) =>
        u.id === user.id
          ? { ...u, security: { ...(u.security || {}), failed: lockedUntil ? 0 : failed, lockedUntil } }
          : u,
      ),
    }))
    if (lockedUntil) return { ok: false, error: `密码错误 ${FAIL_LIMIT} 次，锁定 5 分钟` }
    return { ok: false, error: `密码不对，还可以试 ${FAIL_LIMIT - failed} 次` }
  }

  setState((st) =>
    sync({
      ...st,
      sessionId: user.id,
      sessionExpiresAt: now + (remember ? 7 * DAY : 12 * HOUR),
      users: st.users.map((u) =>
        u.id === user.id
          ? {
              ...u,
              security: { failed: 0, lockedUntil: 0, lastLoginAt: now, lastLoginDevice: deviceOf() },
            }
          : u,
      ),
    }),
  )
  return { ok: true }
}

export function logout() {
  if (cloud.isCloud()) {
    stopCloudSync()
    cloud.logoutCloud()
  }
  setState((s) => ({ ...s, sessionId: null, sessionExpiresAt: 0 }))
}

export function updateMe(patch) {
  setState((s) => {
    if (!s.me) return s
    return {
      ...s,
      users: s.users.map((u) => (u.id === s.sessionId ? { ...u, ...patch } : u)),
    }
  })
}

export async function changePassword(oldPw, newPw) {
  if (cloud.isCloud()) return { ok: false, error: '共享模式暂不支持改密码，请让管理员重置' }
  const s = getState()
  if (!s.me) return { ok: false, error: '先登录' }
  const { hash } = await hashPassword(oldPw, s.me.password.salt)
  if (hash !== s.me.password.hash) return { ok: false, error: '原密码不对' }
  const salt = randomSalt()
  const next = await hashPassword(newPw, salt)
  setState((st) => ({
    ...st,
    users: st.users.map((u) =>
      u.id === st.sessionId ? { ...u, password: { salt, hash: next.hash, algo: next.algo } } : u,
    ),
  }))
  return { ok: true }
}

export function deleteAccount() {
  if (cloud.isCloud()) {
    // 共享模式下的账号在服务器上，前端不能直接删，只能退出
    logout()
    return
  }
  setState((s) => {
    const uid = s.sessionId
    if (!uid) return s
    const circleMembers = { ...s.circleMembers }
    const left = circleMembers[uid] || []
    delete circleMembers[uid]
    const aiByUser = { ...s.aiByUser }
    delete aiByUser[uid]
    const settingsByUser = { ...s.settingsByUser }
    delete settingsByUser[uid]

    // 会话是共享的：把这个人的会话整段删掉（含消息）
    const keepConvs = s.convStore.conversations.filter((c) => !c.members.includes(uid))
    const keepIds = new Set(keepConvs.map((c) => c.id))
    const convStore = {
      conversations: keepConvs,
      messages: Object.fromEntries(
        Object.entries(s.convStore.messages).filter(([cid]) => keepIds.has(cid)),
      ),
    }

    return sync({
      ...s,
      users: s.users.filter((u) => u.id !== uid),
      sessionId: null,
      circleMembers,
      convStore,
      aiByUser,
      settingsByUser,
      buddies: s.buddies
        .filter((b) => b.author !== uid)
        .map((b) => ({ ...b, members: b.members.filter((m) => m !== uid) })),
      requestLog: s.requestLog.filter((r) => r.fromId !== uid && r.toId !== uid),
      friendPairs: s.friendPairs.filter((p) => p.a !== uid && p.b !== uid),
      posts: s.posts.filter((p) => p.authorId !== uid),
      albums: s.albums.filter((a) => a.ownerId !== uid),
      diaries: s.diaries.filter((d) => d.authorId !== uid),
      guestbook: s.guestbook.filter((g) => g.hostId !== uid && g.fromId !== uid),
      visits: s.visits.filter((v) => v.hostId !== uid && v.visitorId !== uid),
      circles: s.circles.map((c) => (left.includes(c.slug) ? { ...c, members: Math.max(0, c.members - 1) } : c)),
    })
  })
}

export function clearAll() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  state = sync(blankState())
  persist()
  listeners.forEach((fn) => fn())
}

/* ---------------- 兴趣圈 / 搭子 ---------------- */

export function joinCircle(slug) {
  setState((s) => {
    const uid = s.sessionId
    if (!uid || (s.circleMembers[uid] || []).includes(slug)) return s
    return {
      ...s,
      circleMembers: { ...s.circleMembers, [uid]: [...(s.circleMembers[uid] || []), slug] },
      circles: s.circles.map((c) => (c.slug === slug ? { ...c, members: c.members + 1 } : c)),
    }
  })
}

export function leaveCircle(slug) {
  setState((s) => {
    const uid = s.sessionId
    if (!uid) return s
    return {
      ...s,
      circleMembers: { ...s.circleMembers, [uid]: (s.circleMembers[uid] || []).filter((x) => x !== slug) },
      circles: s.circles.map((c) => (c.slug === slug ? { ...c, members: Math.max(0, c.members - 1) } : c)),
    }
  })
}

export function joinBuddy(id) {
  setState((s) => {
    const uid = s.sessionId
    if (!uid) return s
    return {
      ...s,
      buddies: s.buddies.map((b) =>
        b.id === id && !b.members.includes(uid) ? { ...b, members: [...b.members, uid] } : b,
      ),
    }
  })
}

export function leaveBuddy(id) {
  setState((s) => {
    const uid = s.sessionId
    if (!uid) return s
    return {
      ...s,
      buddies: s.buddies.map((b) =>
        b.id === id ? { ...b, members: b.members.filter((m) => m !== uid) } : b,
      ),
    }
  })
}

export function createBuddy(draft) {
  const uid = state.sessionId
  if (!uid) return null
  const id = `b_${Date.now().toString(36)}`
  setState((s) => ({
    ...s,
    buddies: [
      {
        id,
        circle: draft.circle,
        title: draft.title,
        author: uid,
        place: draft.place,
        time: draft.time,
        capacity: draft.capacity,
        members: [uid],
        tags: draft.tags || [],
        intro: draft.intro,
        createdAt: Date.now(),
      },
      ...s.buddies,
    ],
  }))
  return id
}

/* ---------------- 消息 / 好友 ---------------- */

export function startChat(peerId) {
  const uid = state.sessionId
  if (!uid || !peerId || peerId === uid) return null
  const existing = state.convStore.conversations.find(
    (c) => c.members.length === 2 && c.members.includes(uid) && c.members.includes(peerId),
  )
  if (existing) return existing.id

  const id = `c_${Date.now().toString(36)}`
  setState((s) => ({
    ...s,
    convStore: {
      conversations: [{ id, members: [uid, peerId], unread: {}, lastAt: Date.now() }, ...s.convStore.conversations],
      messages: { ...s.convStore.messages, [id]: [] },
    },
  }))
  return id
}

export function sendMessage(convId, body) {
  const uid = state.sessionId
  const text = String(body || '').trim()
  if (!uid || !text) return
  const conv = state.convStore.conversations.find((c) => c.id === convId)
  if (!conv || !conv.members.includes(uid)) return

  const msg = { id: `m_${Date.now().toString(36)}`, from: uid, body: text.slice(0, 2000), at: Date.now() }
  setState((s) => ({
    ...s,
    convStore: {
      conversations: s.convStore.conversations.map((c) => {
        if (c.id !== convId) return c
        const unread = { ...c.unread }
        c.members.forEach((m) => {
          if (m !== uid) unread[m] = (unread[m] || 0) + 1
        })
        unread[uid] = 0
        return { ...c, lastAt: msg.at, unread }
      }),
      messages: { ...s.convStore.messages, [convId]: [...(s.convStore.messages[convId] || []), msg] },
    },
  }))
}

export function markRead(convId) {
  const uid = state.sessionId
  if (!uid) return
  const conv = state.convStore.conversations.find((c) => c.id === convId)
  if (!conv || !conv.unread?.[uid]) return
  setState((s) => ({
    ...s,
    convStore: {
      ...s.convStore,
      conversations: s.convStore.conversations.map((c) =>
        c.id === convId ? { ...c, unread: { ...c.unread, [uid]: 0 } } : c,
      ),
    },
  }))
}

export function sendRequest(peerId, note = '') {
  const uid = state.sessionId
  if (!uid || !peerId || peerId === uid) return
  setState((s) => {
    if (s.friends.includes(peerId)) return s
    if (s.requestLog.some((r) => r.fromId === uid && r.toId === peerId && r.status === 'pending')) return s
    return {
      ...s,
      requestLog: [
        { id: `r_${Date.now().toString(36)}`, fromId: uid, toId: peerId, note, at: Date.now(), status: 'pending' },
        ...s.requestLog,
      ],
    }
  })
}

export function acceptRequest(id) {
  setState((s) => {
    const req = s.requestLog.find((r) => r.id === id)
    if (!req) return s
    const [a, b] = [req.fromId, req.toId].sort()
    return {
      ...s,
      requestLog: s.requestLog.map((r) => (r.id === id ? { ...r, status: 'accepted' } : r)),
      friendPairs: s.friendPairs.some((p) => p.a === a && p.b === b)
        ? s.friendPairs
        : [...s.friendPairs, { a, b }],
    }
  })
}

export function declineRequest(id) {
  setState((s) => ({
    ...s,
    requestLog: s.requestLog.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r)),
  }))
}

/* ---------------- 设置 / AI ---------------- */

export function setSetting(key, value) {
  setState((s) => {
    const uid = s.sessionId
    if (!uid) return s
    return {
      ...s,
      settingsByUser: {
        ...s.settingsByUser,
        [uid]: { ...(s.settingsByUser[uid] || { searchable: true, allowRandom: true }), [key]: value },
      },
    }
  })
}

export const AI_DAILY_LIMIT = 3
export const aiQuota = (s) => Math.max(0, AI_DAILY_LIMIT - (s.ai?.used || 0))

const AI_TEMPLATES = {
  icebreaker: (a, b) => [
    `你和 TA 都在「${a[0] || '羽毛球'}」上打过卡，可以问一句：最近一次打得最爽的是哪场？`,
    `TA 最近在找「${b || '搭子'}」，直接说你想加入，比寒暄有用。`,
    `你们都在崂山，可以约在小卖部先见一面，两分钟就知道合不合拍。`,
  ],
  explain: (shared) => [
    `共同点集中在：${(shared.length ? shared : ['暂无重合']).join('、')}。`,
    `差异点其实更适合聊天：一个偏「动」，一个偏「静」，正好互补。`,
    `建议先从共同点开场，把差异留到第二次聊天。`,
  ],
  summary: (tags) => [
    `你的兴趣画像：${tags.join('、')}，偏线下 + 轻社交。`,
    '适合你的搭子类型：固定时间、人数少、有明确目标。',
    '不适合：纯线上吹水群，容易变成已读不回。',
  ],
  topic_suggest: () => [
    '最近崂山校区哪家窗口换了新菜？',
    '你手机里最近一张照片是在哪拍的？',
    '如果这周末只能做一件事，你选睡觉还是出门？',
  ],
}

export function runAiDemo(feature, args = []) {
  const s = state
  if (!s.me) return { ok: false, reason: '请先登录' }
  if ((s.ai?.used || 0) >= AI_DAILY_LIMIT) {
    return { ok: false, reason: `今天的 ${AI_DAILY_LIMIT} 次 AI 额度用完了，明天再来（普通功能不受影响）` }
  }
  const build = AI_TEMPLATES[feature] || AI_TEMPLATES.topic_suggest
  setState((st) => ({
    ...st,
    aiByUser: { ...st.aiByUser, [st.sessionId]: { date: todayKey(), used: (st.ai?.used || 0) + 1 } },
  }))
  return { ok: true, lines: build(...args) }
}

/* ============================================================
   校内网那套：新鲜事 / 相册 / 日志 / 留言板 / 访客
   ============================================================ */

const now = () => Date.now()
const rid = (p) => `${p}_${now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

export function visiblePosts(s, scope = 'friends') {
  const uid = s.me?.id
  if (!uid) return []
  return s.posts
    .filter((p) => p.authorId === uid || scope === 'all' || s.friends.includes(p.authorId))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)
}

export const postsOf = (s, uid) => s.posts.filter((p) => p.authorId === uid).sort((a, b) => b.createdAt - a.createdAt)
export const albumsOf = (s, uid) => s.albums.filter((a) => a.ownerId === uid)
export const diariesOf = (s, uid) => s.diaries.filter((d) => d.authorId === uid).sort((a, b) => b.createdAt - a.createdAt)
export const guestbookOf = (s, uid) => s.guestbook.filter((g) => g.hostId === uid).sort((a, b) => b.at - a.at)
export const visitsOf = (s, uid) => s.visits.filter((v) => v.hostId === uid && v.visitorId !== uid)

export function statsOf(s, uid) {
  return {
    friends: s.friendPairs.filter((p) => p.a === uid || p.b === uid).length,
    posts: s.posts.filter((p) => p.authorId === uid).length,
    albums: s.albums.filter((a) => a.ownerId === uid).length,
    photos: s.albums.filter((a) => a.ownerId === uid).reduce((n, a) => n + a.photos.length, 0),
    diaries: s.diaries.filter((d) => d.authorId === uid).length,
    visits: new Set(s.visits.filter((v) => v.hostId === uid).map((v) => v.visitorId)).size,
    likes: s.posts.filter((p) => p.authorId === uid).reduce((n, p) => n + p.likes.length, 0),
  }
}

// 好友推荐：同校区 / 同专业 / 共同标签 / 共同好友，加权排序
export function friendSuggestions(s, limit = 6) {
  const me = s.me
  if (!me) return []
  return s.people
    .filter((p) => !s.friends.includes(p.id))
    .map((p) => {
      const shared = p.tags.filter((t) => me.tags.includes(t))
      const mutual = s.friendPairs.filter(
        (f) => (f.a === p.id || f.b === p.id) && (f.a === me.id || f.b === me.id),
      ).length
      const score =
        (p.campus === me.campus ? 3 : 0) +
        (p.major === me.major ? 4 : 0) +
        shared.length * 2 +
        mutual * 2
      return { person: p, shared, mutual, score }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/* ---------------- 新鲜事 ---------------- */

export function createPost({ text = '', images = [], mood = '' }) {
  const uid = state.sessionId
  if (!uid) return null
  if (!text.trim() && images.length === 0) return null
  const post = {
    id: rid('p'),
    authorId: uid,
    text: text.trim().slice(0, 1000),
    images: images.slice(0, 9),
    mood,
    createdAt: now(),
    likes: [],
    comments: [],
  }
  setState((s) => ({ ...s, posts: [post, ...s.posts] }))
  return post.id
}

export function deletePost(id) {
  setState((s) => ({ ...s, posts: s.posts.filter((p) => p.id !== id || p.authorId !== s.sessionId) }))
}

function mapTarget(s, id, fn) {
  return {
    ...s,
    posts: s.posts.map((p) => (p.id === id ? fn(p) : p)),
    diaries: s.diaries.map((d) => (d.id === id ? fn(d) : d)),
  }
}

export function toggleLike(id) {
  setState((s) => {
    const uid = s.sessionId
    if (!uid) return s
    return mapTarget(s, id, (item) => ({
      ...item,
      likes: item.likes.includes(uid) ? item.likes.filter((x) => x !== uid) : [...item.likes, uid],
    }))
  })
}

export function addComment(id, text) {
  const uid = state.sessionId
  const body = String(text || '').trim()
  if (!uid || !body) return
  const c = { id: rid('cm'), from: uid, text: body.slice(0, 300), at: now() }
  setState((s) => mapTarget(s, id, (item) => ({ ...item, comments: [...item.comments, c] })))
}

export function removeComment(id, commentId) {
  setState((s) =>
    mapTarget(s, id, (item) => ({
      ...item,
      comments: item.comments.filter((c) => c.id !== commentId || c.from !== s.sessionId),
    })),
  )
}

/* ---------------- 相册 ---------------- */

export function createAlbum(name) {
  const uid = state.sessionId
  const title = String(name || '').trim()
  if (!uid || !title) return null
  const album = { id: rid('al'), ownerId: uid, name: title.slice(0, 20), createdAt: now(), photos: [] }
  setState((s) => ({ ...s, albums: [album, ...s.albums] }))
  return album.id
}

export function addPhoto(albumId, dataUrl, caption = '') {
  const uid = state.sessionId
  if (!uid || !dataUrl) return false
  let ok = true
  setState((s) => ({
    ...s,
    albums: s.albums.map((a) => {
      if (a.id !== albumId || a.ownerId !== uid) return a
      if (a.photos.length >= 24) {
        ok = false
        return a
      }
      return { ...a, photos: [...a.photos, { id: rid('ph'), dataUrl, caption: caption.slice(0, 60), at: now() }] }
    }),
  }))
  return ok
}

export function deletePhoto(albumId, photoId) {
  setState((s) => ({
    ...s,
    albums: s.albums.map((a) =>
      a.id === albumId && a.ownerId === s.sessionId
        ? { ...a, photos: a.photos.filter((p) => p.id !== photoId) }
        : a,
    ),
  }))
}

export function deleteAlbum(albumId) {
  setState((s) => ({ ...s, albums: s.albums.filter((a) => a.id !== albumId || a.ownerId !== s.sessionId) }))
}

/* ---------------- 学习资料 ---------------- */

export function addMaterial({ title, course, desc, dataUrl, fileName = '', size = 0 }) {
  const uid = state.sessionId
  if (!uid || !title || !dataUrl) return null
  const id = `mat_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  const mat = {
    id,
    ownerId: uid,
    title: String(title).slice(0, 60),
    course: String(course || '').slice(0, 20),
    desc: String(desc || '').slice(0, 200),
    dataUrl,
    fileName,
    size: Number(size) || 0,
    downloads: 0,
    createdAt: Date.now(),
  }
  setState((s) => ({ ...s, materials: [mat, ...s.materials] }))
  return id
}

export function deleteMaterial(id) {
  setState((s) => ({ ...s, materials: s.materials.filter((m) => m.id !== id) }))
}

export function downloadMaterial(id) {
  setState((s) => ({
    ...s,
    materials: s.materials.map((m) => (m.id === id ? { ...m, downloads: (m.downloads || 0) + 1 } : m)),
  }))
  cloud.op('material.download', { id })
}

/* ---------------- 日志 ---------------- */

export function createDiary({ title, body }) {
  const uid = state.sessionId
  const t = String(title || '').trim()
  const b = String(body || '').trim()
  if (!uid || !t || !b) return null
  const diary = {
    id: rid('d'),
    authorId: uid,
    title: t.slice(0, 60),
    body: b.slice(0, 8000),
    createdAt: now(),
    likes: [],
    comments: [],
  }
  setState((s) => ({ ...s, diaries: [diary, ...s.diaries] }))
  return diary.id
}

export function updateDiary(id, { title, body }) {
  setState((s) => ({
    ...s,
    diaries: s.diaries.map((d) =>
      d.id === id && d.authorId === s.sessionId
        ? { ...d, title: String(title || d.title).slice(0, 60), body: String(body || d.body).slice(0, 8000) }
        : d,
    ),
  }))
}

export function deleteDiary(id) {
  setState((s) => ({ ...s, diaries: s.diaries.filter((d) => d.id !== id || d.authorId !== s.sessionId) }))
}

/* ---------------- 留言板 / 访客 ---------------- */

export function writeGuestbook(hostId, text) {
  const uid = state.sessionId
  const body = String(text || '').trim()
  if (!uid || !body || uid === hostId) return false
  setState((s) => ({
    ...s,
    guestbook: [{ id: rid('g'), hostId, fromId: uid, text: body.slice(0, 300), at: now() }, ...s.guestbook],
  }))
  return true
}

export function deleteGuestbook(id) {
  setState((s) => ({
    ...s,
    guestbook: s.guestbook.filter((g) => g.id !== id || (g.fromId !== s.sessionId && g.hostId !== s.sessionId)),
  }))
}

export function recordVisit(hostId) {
  const uid = state.sessionId
  if (!uid || !hostId || uid === hostId) return
  setState((s) => {
    if (s.visits.some((v) => v.hostId === hostId && v.visitorId === uid && now() - v.at < 60000)) return s
    return {
      ...s,
      visits: [{ hostId, visitorId: uid, at: now() }, ...s.visits].slice(0, 300),
    }
  })
}

export function removeFriend(peerId) {
  setState((s) => ({
    ...s,
    friendPairs: s.friendPairs.filter(
      (p) => !((p.a === s.sessionId && p.b === peerId) || (p.b === s.sessionId && p.a === peerId)),
    ),
  }))
}
