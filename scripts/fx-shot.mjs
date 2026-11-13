// 给欢迎页和首页各截一张，检查动效有没有把布局打乱
import { readFileSync, writeFileSync } from 'node:fs'

const [, , port = '9222', base = 'http://127.0.0.1:8787', tokenFile = '.tmp/token.txt'] = process.argv
const token = readFileSync(tokenFile, 'utf8').trim()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.filter((t) => t.type === 'page').find((t) => t.url.startsWith(base)) || list.find((t) => t.type === 'page')
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
await send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 1000, deviceScaleFactor: 1, mobile: false })

const shot = async (name) => {
  await sleep(1400)
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(`_shots/${name}.png`, Buffer.from(r.result.data, 'base64'))
  console.log('saved', `_shots/${name}.png`)
}

// 1) 欢迎页（未登录）
await send('Page.navigate', { url: `${base}/?w=${Date.now()}` })
await sleep(1200)
await send('Runtime.evaluate', { expression: `localStorage.removeItem('xiangyu.token'); localStorage.removeItem('xiangyu.state.v2')` })
await send('Page.navigate', { url: `${base}/?w2=${Date.now()}#/welcome` })
await shot('fx-welcome')

// 2) 首页（管理员登录态）
await send('Runtime.evaluate', { expression: `localStorage.setItem('xiangyu.token', ${JSON.stringify(token)})` })
await send('Page.navigate', { url: `${base}/?h=${Date.now()}#/` })
await shot('fx-home')

// 3) 滚动到底，检查进场动画与阅读进度条
await send('Runtime.evaluate', { expression: `window.scrollTo({top: document.body.scrollHeight})` })
await shot('fx-home-bottom')

ws.close()
