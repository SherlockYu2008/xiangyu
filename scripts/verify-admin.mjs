// 验证管理员权限真的在服务端生效（不是前端藏按钮）
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'

const BASE = 'http://127.0.0.1:8787'
const SECRET = 'xiangyu-dev-secret-change-me'
const world = JSON.parse(readFileSync('server/data/world.json', 'utf8'))

const tokenFor = (nick) => {
  const u = world.users.find((x) => x.nickname === nick)
  const exp = Date.now() + 86400000
  const body = `${u.id}.${exp}`
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`
}

const api = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, ...(await res.json()) }
}

const admin = tokenFor('雨时')
const normal = tokenFor('feafa')
const assert = (cond, msg) => {
  if (!cond) {
    console.error('✗', msg)
    process.exit(1)
  }
  console.log('  ✓', msg)
}

console.log('1. 没有 token 不能调管理接口')
const anon = await api('/api/op', { type: 'admin.announce', payload: { text: 'x' } })
assert(anon.status === 401, '匿名请求被拒绝（401）')

console.log('2. 普通用户调用管理接口不生效')
const postId = `p_adm_${Date.now()}`
await api('/api/op', { type: 'post.create', payload: { post: { id: postId, text: '管理员测试动态', images: [], mood: '' } } }, normal)
await api('/api/op', { type: 'admin.announce', payload: { text: '普通用户改公告' } }, normal)
await api('/api/op', { type: 'admin.post.delete', payload: { id: postId } }, normal)
let w = await api('/api/world', undefined, normal)
assert(!w.world.announcement, '普通用户改不了公告')
assert(w.world.posts.some((p) => p.id === postId), '普通用户删不掉别人的动态')

console.log('3. 管理员可以做')
await api('/api/op', { type: 'admin.announce', payload: { text: '周六下午三点，崂山操场羽毛球，缺 4 人。' } }, admin)
await api('/api/op', { type: 'admin.post.delete', payload: { id: postId } }, admin)
await api('/api/op', { type: 'admin.post.pin', payload: { id: 'p_pin_test' } }, admin)
w = await api('/api/world', undefined, admin)
assert(w.world.announcement?.text?.includes('羽毛球'), '管理员能发公告')
assert(!w.world.posts.some((p) => p.id === postId), '管理员能删除任意动态')

console.log('4. 管理员不能封自己')
await api('/api/op', { type: 'admin.user.ban', payload: { id: w.me.id } }, admin)
w = await api('/api/world', undefined, admin)
assert(!w.world.users.find((u) => u.id === w.me.id).banned, '管理员封不了自己')

console.log('5. 收尾：清掉测试公告')
await api('/api/op', { type: 'admin.announce', payload: { text: '' } }, admin)

console.log('\n管理员权限验证通过。')
