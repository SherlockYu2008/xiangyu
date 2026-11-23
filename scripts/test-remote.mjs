// 端到端：打开构建版 → 用云端已有的账号登录 → 看能不能看到另一个人
import { writeFileSync } from 'node:fs'

const [, , port = '9222', base = 'http://127.0.0.1:4173'] = process.argv
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
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
await send('Emulation.setDeviceMetricsOverride', { width: 1360, height: 900, deviceScaleFactor: 1, mobile: false })

await send('Page.navigate', { url: base + '/?t=' + Date.now() })
await sleep(2500)

// 登录
const login = await send('Runtime.evaluate', {
  awaitPromise: true,
  expression: `
  (async () => {
    const pick = (sel) => [...document.querySelectorAll(sel)]
    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const nick = pick('input:not([type=checkbox]):not([type=password])')[0]
    const pw = pick('input[type=password]')[0]
    if (!nick || !pw) return 'no-form:' + document.body.innerText.slice(0, 80)
    setVal(nick, '甲同学')
    setVal(pw, 'Abc123456')
    await new Promise(r => setTimeout(r, 300))
    const btn = pick('button').find(b => b.textContent.trim().startsWith('登录'))
    if (!btn) return 'no-button'
    btn.click()
    return 'clicked'
  })()`,
})
console.log('登录操作:', login.result?.result?.value)
await sleep(3000)

const after = await send('Runtime.evaluate', {
  expression: `document.body.innerText.replace(/\\s+/g,' ').slice(0, 220)`,
})
console.log('页面内容:', after.result?.result?.value)

let shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('_shots/remote-home.png', Buffer.from(shot.result.data, 'base64'))

// 去朋友页看另一个人
await send('Runtime.evaluate', { expression: `location.hash = '#/friends'` })
await sleep(2500)
const friends = await send('Runtime.evaluate', {
  expression: `document.body.innerText.replace(/\\s+/g,' ').slice(0, 300)`,
})
console.log('朋友页:', friends.result?.result?.value)
console.log('看得到乙同学:', String(friends.result?.result?.value).includes('乙同学'))

shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('_shots/remote-friends.png', Buffer.from(shot.result.data, 'base64'))

ws.close()
