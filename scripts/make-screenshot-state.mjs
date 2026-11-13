// 只用于「截图/自检」的临时数据生成器：注册三个测试账号，发动态、建相册、写日志、留言、加好友。
// 生成结果写到 .tmp/state-demo.json，不会进入产品代码，也不预置在任何地方。
// 用法：node scripts/make-screenshot-state.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
}

const store = await import('../src/lib/store.js')

const svg = (label, c1, c2) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="640" height="640" fill="url(#g)"/><text x="50%" y="53%" font-size="44" fill="rgba(255,255,255,.94)" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`,
  )

const P = (nickname, tags, major = '高分子材料与工程', campus = '崂山校区') => ({
  nickname,
  password: 'Abc123456',
  grade: '大二',
  campus,
  major,
  bio: '羽毛球菜鸡、胶片爱好者、摇滚现场常客。',
  tags,
})

await store.register(P('测试甲', ['羽毛球', '摄影', '摇滚', '咖啡']))
store.createPost({
  text: '刚在图书馆三楼抢到靠窗的位置，阳光正好。有没有人下午一起去操场打球？',
  images: [svg('崂山 · 秋', '#5b55f0', '#c084fc'), svg('图书馆 3F', '#22b8a0', '#6ee7d7')],
  mood: '📚 在自习',
})
const albumId = store.createAlbum('崂山的秋天')
store.addPhoto(albumId, svg('操场', '#f5a623', '#ffd08a'), '九月，操场边的树')
store.addPhoto(albumId, svg('二餐三楼', '#f0779a', '#fbb6ce'), '这家的糖醋里脊')
store.addPhoto(albumId, svg('宿舍窗台', '#4f8df7', '#8ec5ff'), '晒被子的一天')
store.createDiary({
  title: '来青科的第二年，我终于把操场跑熟了',
  body: '去年这个时候，我连二餐和图书馆都分不清。\n\n今年能闭着眼睛从宿舍走到操场，知道几点人最少，知道哪条路人最多。\n\n九月开学那天，我在看台上坐了一下午，看着新生拖着箱子找宿舍。去年我也是那样。',
})

const postA = store.getState().posts[0].id

store.logout()
await store.register(P('测试乙', ['羽毛球', '吉他', '文学'], '计算机科学与技术'))
store.createPost({ text: '晚上在琴房待了两个小时，还是只会那六个和弦。但《南方姑娘》能弹完了。', mood: '🌙 失眠' })
store.addComment(postA, '下午四点操场见？我带两个新球')
store.writeGuestbook(store.getState().users.find((u) => u.nickname === '测试甲').id, '来踩一脚，改天一起打球。')
const idA = store.getState().users.find((u) => u.nickname === '测试甲').id
store.sendRequest(idA, '同在崂山，加个好友')
const idB = store.getState().sessionId
store.recordVisit(idA)

store.logout()
await store.login('测试甲', 'Abc123456')
const req = store.getState().requests.find((r) => r.fromId === idB && r.status === 'pending')
if (req) store.acceptRequest(req.id)
store.createPost({ text: '加到一个球友，周六去四方体育馆。谁在四方，可以一起。' })
store.sendMessage(store.startChat(idB), '周六上午十点，四方体育馆二号场，来吗？')

const state = store.getState()
mkdirSync('.tmp', { recursive: true })
writeFileSync('.tmp/state-demo.json', mem.get('xiangyu.state.v2'))
writeFileSync(
  '.tmp/shots.json',
  JSON.stringify(
    [
      { name: 'home', hash: '/' },
      { name: 'profile', hash: `/u/${idB}` },
      { name: 'albums', hash: '/albums' },
      { name: 'album', hash: `/albums/${albumId}` },
      { name: 'diary', hash: '/diary' },
      { name: 'friends', hash: '/friends' },
    ],
    null,
    2,
  ),
)
console.log('demo state ready:', state.posts.length, 'posts,', state.albums.length, 'albums,', state.diaries.length, 'diaries')
console.log('A =', idA, ' B =', idB)
