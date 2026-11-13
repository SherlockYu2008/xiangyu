// 验证「连上共享后端」的浏览器路径：注册 → 存 token → 刷新 → 截图
// 用法：node scripts/cloud-shot.mjs 9222 http://127.0.0.1:8787 13800138000
import { writeFileSync } from 'node:fs'

const [, , port = '9222', base = 'http://127.0.0.1:8787', nick = '截图同学'] = process.argv
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.filter((t) => t.type === 'page').find((t) => t.url.startsWith(base)) || list.find((t) => t.type === 'page')
if (!page) throw new Error('没有页面目标')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.addEventListener('open', res)
  ws.addEventListener('error', rej)
})
let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
const send = (method, params = {}) =>
  new Promise((res) => {
    const id = ++seq
    pending.set(id, res)
    ws.send(JSON.stringify({ id, method, params }))
  })

await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${base}/?x=${Date.now()}` })
await sleep(1600)

const reg = await send('Runtime.evaluate', {
  expression: `(async () => {
    const name = ${JSON.stringify(nick)} + Math.floor(Math.random() * 900 + 100)
    const r = await fetch('/api/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname: name, password: 'Abc123456', grade: '大二', campus: '崂山校区', major: '高分子材料与工程', bio: '连上服务器的测试账号', tags: ['羽毛球','摄影','摇滚'] })
    }).then(r => r.json())
    localStorage.setItem('xiangyu.token', r.token)
    return name
  })()`,
  awaitPromise: true,
  returnByValue: true,
})

const name = reg.result?.result?.value
console.log('注册并写入 token：', name)

await send('Page.navigate', { url: `${base}/?y=${Date.now()}` })
await sleep(2000)

const probe = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    rendered: document.querySelector('#root')?.children.length || 0,
    text: document.body.innerText.slice(0, 120).replace(/\\s+/g, ' '),
    token: Boolean(localStorage.getItem('xiangyu.token'))
  })`,
  returnByValue: true,
})
console.log('页面状态：', probe.result?.result?.value)

const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('_shots/cloud-home.png', Buffer.from(shot.result.data, 'base64'))
console.log('saved _shots/cloud-home.png')
ws.close()
