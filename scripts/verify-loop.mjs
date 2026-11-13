// 回归测试：本地 ↔ 服务器的同步不能「自激」。
// 1) 服务器快照拉回本地时不许再推回服务器（否则相册自我复制）
// 2) 本地删除必须推给服务器（否则轮询后又复活）
const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
}

const json = (data) => ({ ok: true, status: 200, json: async () => data })

let opCalls = []
let serverWorld = {
  users: [{ id: 'u1', nickname: '甲', grade: '大二', campus: '崂山校区', major: '计算机', bio: '', tags: [] }],
  posts: [], albums: [], diaries: [], guestbook: [], visits: [],
  friendPairs: [], requestLog: [], buddies: [],
  circles: [{ slug: 'sport', name: '运动健身', emoji: '🏸', tone: 'mint', desc: '', tags: [], members: 0 }],
  circleMembers: {}, convStore: { conversations: [], messages: {} },
}

function applyOp(type, p) {
  if (type === 'album.create') {
    if (!serverWorld.albums.some((a) => a.id === p.id)) {
      serverWorld.albums.unshift({ id: p.id, ownerId: 'u1', name: p.name, createdAt: Date.now(), photos: [] })
    }
  }
  if (type === 'album.delete') serverWorld.albums = serverWorld.albums.filter((a) => a.id !== p.id)
  if (type === 'album.photo') {
    const a = serverWorld.albums.find((x) => x.id === p.albumId)
    if (a) a.photos.push({ id: p.photo.id, dataUrl: p.photo.dataUrl, caption: p.photo.caption, at: Date.now() })
  }
  if (type === 'album.photo.delete') {
    const a = serverWorld.albums.find((x) => x.id === p.albumId)
    if (a) a.photos = a.photos.filter((ph) => ph.id !== p.photoId)
  }
  if (type === 'diary.create' && !serverWorld.diaries.some((d) => d.id === p.diary.id)) {
    serverWorld.diaries.unshift({ id: p.diary.id, authorId: 'u1', title: p.diary.title, body: p.diary.body, createdAt: Date.now(), likes: [], comments: [] })
  }
  if (type === 'diary.delete') serverWorld.diaries = serverWorld.diaries.filter((d) => d.id !== p.id)
}

globalThis.fetch = async (url, opts) => {
  const u = String(url)
  if (u.includes('/api/health')) return json({ ok: true })
  if (u.includes('/api/op')) {
    const { type, payload } = JSON.parse(opts.body)
    opCalls.push({ type, payload })
    applyOp(type, payload)
    return json({ ok: true })
  }
  if (u.includes('/api/world')) {
    return json({ ok: true, world: JSON.parse(JSON.stringify(serverWorld)), me: serverWorld.users[0] })
  }
  return json({ ok: true })
}

const cloud = await import('../src/lib/cloud.js')
const store = await import('../src/lib/store.js')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await cloud.probe()
cloud.setToken('fake.token.sig')

const sync = async () => {
  const r = await cloud.world()
  store.adoptCloud(r.world, 'u1')
  await sleep(60)
}
const albums = () => store.getState().albums

console.log('1. 快照不会被回推')
await sync(); await sync(); await sync()
if (opCalls.length !== 0) {
  console.error('✗ 拉取快照时产生了', opCalls.length, '次推送')
  process.exit(1)
}
console.log('  ✓ 三次轮询，0 次推送')

console.log('2. 新建相册只推一次')
store.createAlbum('崂山的秋天')
await sleep(80)
const createOps = opCalls.filter((o) => o.type === 'album.create')
console.log('  ✓ 推送次数：', createOps.length)
if (createOps.length !== 1) process.exit(1)
await sync()
if (albums().length !== 1) {
  console.error('✗ 同步后本地相册数应为 1，实际', albums().length)
  process.exit(1)
}
console.log('  ✓ 同步后本地 1 个相册')

console.log('3. 删除相册不会复活')
const id = albums()[0].id
store.deleteAlbum(id)
await sleep(80)
const delOps = opCalls.filter((o) => o.type === 'album.delete')
console.log('  ✓ 发出删除操作：', delOps.length, '次')
if (delOps.length !== 1) process.exit(1)
await sync()
if (albums().length !== 0) {
  console.error('✗ 删除后同步又出现', albums().length, '个相册')
  process.exit(1)
}
await sync()
if (albums().length !== 0) {
  console.error('✗ 第二次轮询后相册复活')
  process.exit(1)
}
console.log('  ✓ 连续两次轮询，相册没有复活')

console.log('\n同步回归全部通过。')
