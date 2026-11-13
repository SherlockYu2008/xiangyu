// 用管理员 token 直接进 /admin 截图
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
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1500, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${base}/?z=${Date.now()}` })
await sleep(1500)

await send('Runtime.evaluate', {
  expression: `localStorage.removeItem('xiangyu.state.v2'); localStorage.setItem('xiangyu.token', ${JSON.stringify(token)});`,
})

await send('Page.navigate', { url: `${base}/?a=${Date.now()}#/admin` })
await sleep(2200)

const probe = await send('Runtime.evaluate', {
  expression: `JSON.stringify({ rendered: document.querySelector('#root')?.children.length || 0, text: document.body.innerText.slice(0, 120).replace(/\\s+/g, ' ') })`,
  returnByValue: true,
})
console.log('页面状态：', probe.result?.result?.value)

const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('_shots/admin.png', Buffer.from(shot.result.data, 'base64'))
console.log('saved _shots/admin.png')
ws.close()
