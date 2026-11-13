// 用两个真实账号打一遍共享后端，验证「别人真的能看到你的内容」。
// 用法：先 node server/index.mjs，再 node scripts/verify-server.mjs [端口]
const PORT = process.argv[2] || 8787
const BASE = `http://127.0.0.1:${PORT}`

const api = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, ...(await res.json()) }
}

const ok = (m) => console.log('  ✓', m)
const assert = (cond, m) => {
  if (!cond) {
    console.error('  ✗', m)
    process.exit(1)
  }
}

console.log('1. 健康检查')
const health = await api('/api/health')
assert(health.ok, '服务在线')
ok(`在线，已有 ${health.users} 个账号`)

console.log('2. 两个真人注册')
const a = await api('/api/register', {
  nickname: '甲同学', password: 'Abc123456', grade: '大二', campus: '崂山校区',
  major: '高分子材料与工程', bio: '', tags: ['羽毛球', '摄影', '摇滚'],
})
assert(a.ok, a.error || '甲注册失败')
const aId = a.world.users.find((u) => u.nickname === '甲同学').id
const b = await api('/api/register', {
  nickname: '乙同学', password: 'Abc123456', grade: '大三', campus: '四方校区',
  major: '计算机科学与技术', bio: '', tags: ['羽毛球', '吉他', '文学'],
})
assert(b.ok, b.error || '乙注册失败')
ok('两个账号都拿到 token')

console.log('3. 甲发动态，乙能看见')
const postId = `p_test_${Date.now()}`
await api('/api/op', { type: 'post.create', payload: { post: { id: postId, text: '今天操场有人打球吗？', images: [], mood: '' } } }, a.token)
let w = await api('/api/world', undefined, b.token)
assert(w.world.posts.some((p) => p.id === postId), '乙看不到甲的动态')
ok('乙在自己的 world 里看到甲的动态')

console.log('4. 乙点赞 + 评论')
await api('/api/op', { type: 'post.like', payload: { id: postId } }, b.token)
await api('/api/op', { type: 'post.comment', payload: { id: postId, text: '有，四点见' } }, b.token)
w = await api('/api/world', undefined, a.token)
const post = w.world.posts.find((p) => p.id === postId)
assert(post.likes.length === 1, '点赞没同步')
assert(post.comments.length === 1 && post.comments[0].text === '有，四点见', '评论没同步')
ok('甲的动态上出现了乙的赞和评论')

console.log('5. 加好友')
await api('/api/op', { type: 'friend.request', payload: { toId: w.me.id, note: '一起打球' } }, b.token)
w = await api('/api/world', undefined, a.token)
const req = w.world.requestLog.find((r) => r.status === 'pending')
assert(req, '好友申请没到')
await api('/api/op', { type: 'friend.accept', payload: { id: req.id } }, a.token)
w = await api('/api/world', undefined, b.token)
assert(w.world.friendPairs.length === 1, '好友关系没建立')
ok('好友关系双端一致')

console.log('6. 私信')
const chat = await api('/api/op', { type: 'chat.start', payload: { peerId: aId } }, b.token)
const convId = chat.convId
await api('/api/op', { type: 'chat.send', payload: { convId, body: '明晚七点，二号场' } }, b.token)
w = await api('/api/world', undefined, a.token)
const conv = w.world.convStore.conversations.find((c) => c.id === convId)
assert(conv && w.world.convStore.messages[convId].length === 1, '私信没同步')
assert(conv.unread[aId] === 1, '未读没记上')
ok('甲收到未读，内容一致')

console.log('7. 越权检查')
const noToken = await api('/api/world')
assert(noToken.status === 401, '没有 token 也能读数据')
const bad = await api('/api/world', undefined, 'fake.token.sig')
assert(bad.status === 401, '伪造 token 也能读数据')
ok('没有有效 token 一律 401')

console.log('\n共享后端全部通过。')
