// 用 Node 直接跑数据层，验证「没有假用户 + 真人注册登录 + 两个真人能互相看见」。
// 运行：node scripts/verify-store.mjs
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'node:fs'

const mem = new Map()
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => {
    mem.set(k, String(v))
  },
  removeItem: (k) => {
    mem.delete(k)
  },
}

const store = await import('../src/lib/store.js')
const ok = (msg) => console.log('  ✓', msg)

const profile = (nickname, tags) => ({
  nickname,
  password: 'Abc123456',
  grade: '大二',
  campus: '崂山校区',
  major: '计算机科学与技术',
  bio: '',
  tags,
})

console.log('1. 初始状态')
let s = store.getState()
assert.equal(s.users.length, 0)
assert.equal(s.me, null)
assert.equal(s.people.length, 0)
assert.equal(s.buddies.length, 0)
ok('没有任何预置用户、搭子、消息')

console.log('2. 注册第一个真人')
let r = await store.register({ ...profile('测试甲', ['羽毛球', '摄影', '摇滚']), studentNo: '202301010101' })
assert.equal(r.ok, true, r.error)
s = store.getState()
assert.equal(s.me.nickname, '测试甲')
assert.equal(s.me.password.hash.length, 64)
assert.equal(s.me.password.algo, 'pbkdf2-sha256-120k')
assert.equal(s.me.studentNo, '2023******')
ok('密码只存 PBKDF2 摘要，学号打码')

console.log('3. 重名与弱密码')
r = await store.register(profile('测试甲', ['羽毛球', '摄影', '摇滚']))
assert.equal(r.ok, false)
ok('同名昵称被拒绝：' + r.error)

console.log('4. 退出与登录')
store.logout()
assert.equal(store.getState().me, null)
r = await store.login('测试甲', '错误密码')
assert.equal(r.ok, false)
ok('错密码被拒绝')
r = await store.login('测试甲', 'Abc123456')
assert.equal(r.ok, true)
ok('对密码可登录')

console.log('5. 圈子与搭子')
store.joinCircle('sport')
s = store.getState()
assert.deepEqual(s.myCircles, ['sport'])
assert.equal(s.circles.find((c) => c.slug === 'sport').members, 1)
store.createBuddy({
  circle: 'sport',
  title: '羽毛球搭子 · 缺 2 人',
  time: '周二 18:30',
  place: '四方 · 体育馆',
  capacity: 4,
  intro: '水平不限',
  tags: ['羽毛球'],
})
s = store.getState()
const bid = s.buddies[0].id
assert.equal(s.buddies[0].author, s.me.id)
const uidA = s.me.id
ok('发搭子自动成为发起人')

console.log('6. 第二个真人注册后能看见彼此')
store.logout()
r = await store.register(profile('测试乙', ['羽毛球', '吉他', '文学']))
assert.equal(r.ok, true, r.error)
s = store.getState()
assert.equal(s.people.length, 1)
assert.equal(s.people[0].nickname, '测试甲')
assert.equal(s.people[0].password, undefined)
ok('乙能看到甲，且看不到密码字段')

store.joinBuddy(bid)
assert.equal(store.getState().buddies[0].members.length, 2)
ok('乙加入甲的搭子')

console.log('7. 私信是真的互通')
const cid = store.startChat(uidA)
assert.ok(cid)
store.sendMessage(cid, '在吗，明天几点打球？')
s = store.getState()
assert.equal(s.messages[cid].length, 1)
assert.equal(s.conversations.find((c) => c.id === cid).unread, 0)
store.logout()
await store.login('测试甲', 'Abc123456')
s = store.getState()
const conv = s.conversations.find((c) => c.id === cid)
assert.equal(conv.unread, 1)
assert.equal(s.messages[cid][0].body, '在吗，明天几点打球？')
ok('甲收到乙的 1 条未读，内容正确')
store.markRead(cid)
assert.equal(store.getState().conversations.find((c) => c.id === cid).unread, 0)
ok('已读后未读清零')

console.log('8. 删除账号会清掉自己的痕迹')
store.logout()
await store.login('测试乙', 'Abc123456')
store.deleteAccount()
s = store.getState()
assert.equal(s.users.length, 1)
assert.equal(s.conversations.length, 0)
assert.equal(s.buddies[0].members.length, 1)
ok('乙删除后，会话消失、搭子只剩甲')

console.log('9. 持久化')
await store.login('测试甲', 'Abc123456')
const raw = mem.get('xiangyu.state.v2')
assert.ok(raw.includes('测试甲'))
assert.ok(!raw.includes('测试乙'))
mkdirSync('.tmp', { recursive: true })
writeFileSync('.tmp/state-sample.json', raw)
ok(`localStorage 写入 ${raw.length} 字节（含已登录会话，可直接拿去截图）`)

console.log('10. 连续输错 5 次会锁定')
store.logout()
await store.register(profile('测试丙', ['羽毛球', '摄影', '摇滚']))
store.logout()
let last
for (let i = 0; i < 5; i += 1) last = await store.login('测试丙', 'WrongPass1')
assert.equal(last.ok, false)
assert.match(last.error, /锁定/)
ok('第 5 次失败后账号锁定：' + last.error)

const blocked = await store.login('测试丙', 'Abc123456')
assert.equal(blocked.ok, false)
assert.match(blocked.error, /锁定|分钟/)
ok('锁定期内即使密码正确也进不去')

console.log('11. 弱密码被拒绝')
const weak = await store.register({ ...profile('测试丁', ['羽毛球', '摄影', '摇滚']), password: '12345678' })
assert.equal(weak.ok, false)
ok('拒绝弱密码：' + weak.error)

const guessable = await store.register({ ...profile('测试丁', ['羽毛球', '摄影', '摇滚']), password: '测试丁12345' })
assert.equal(guessable.ok, false)
ok('拒绝把昵称写进密码：' + guessable.error)

console.log('\n全部通过。')
