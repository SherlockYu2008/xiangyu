// 本地模拟 Cloudflare Pages Functions，验证接口能跑通
// 用法：node scripts/test-worker.mjs
import { pathToFileURL } from 'node:url'

// 简易 KV
const store = new Map()
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null },
  async put(k, v) { store.set(k, String(v)) },
  async delete(k) { store.delete(k) },
}

const mod = await import(pathToFileURL('functions/api/[[path]].js').href)
const uploads = await import(pathToFileURL('functions/uploads/[name].js').href)

const env = { WORLD: KV, XY_SECRET: 'test-secret' }

const call = (path, { method = 'GET', body, token } = {}) =>
  mod.onRequest({
    request: new Request('https://x.local' + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
    params: { path: [] },
  })

const j = async (r) => ({ status: r.status, data: await r.json().catch(() => null) })

console.log('health:', await j(await call('/api/health')))

const reg = await j(await call('/api/register', { method: 'POST', body: { nickname: '测试甲', password: 'Abc123456', grade: '大二', campus: '崂山校区', major: '高分子', tags: ['羽毛球'] } }))
console.log('注册:', reg.status, reg.data.ok ? 'ok' : reg.data.error, '| 管理员:', reg.data.world?.users?.[0]?.role)
const token = reg.data.token

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const post = await j(await call('/api/op', { method: 'POST', token, body: { type: 'post.create', payload: { post: { id: 'p1', text: '带图的动态', images: [png], mood: '' } } } }))
console.log('发动态:', post.status, post.data.ok)

const w = await j(await call('/api/world', { token }))
console.log('世界用户:', w.data.world.users.length, '| 动态:', w.data.world.posts.length, '| 图片:', w.data.world.posts[0]?.images?.[0])

const imgName = w.data.world.posts[0].images[0].replace('/uploads/', '')
const img = await uploads.onRequest({ request: new Request('https://x.local/uploads/' + imgName), env, params: { name: imgName } })
console.log('图片读取:', img.status, img.headers.get('content-type'))

const login = await j(await call('/api/login', { method: 'POST', body: { nickname: '测试甲', password: 'Abc123456' } }))
console.log('登录:', login.status, login.data.ok ? 'ok' : login.data.error)

const bad = await j(await call('/api/login', { method: 'POST', body: { nickname: '测试甲', password: 'wrongpass' } }))
console.log('错密码:', bad.status, bad.data.error)

const noauth = await j(await call('/api/world'))
console.log('未登录访问:', noauth.status, noauth.data.error)
