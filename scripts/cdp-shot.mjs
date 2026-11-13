// 用 Chrome DevTools Protocol 给「已登录」的页面截图。
// 先跑 node scripts/verify-store.mjs 生成 .tmp/state-sample.json（真实注册出来的状态）。
// 用法：node scripts/cdp-shot.mjs 9222 http://127.0.0.1:4173 .tmp/state-sample.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const [, , port = '9222', base = 'http://127.0.0.1:4173', seedFile] = process.argv
const seed = seedFile ? readFileSync(seedFile, 'utf8') : null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const targets = list.filter((t) => t.type === 'page')
// Edge 首次启动可能带一个 edge:// 的同步弹窗，别选它
const page =
  targets.find((t) => t.url.startsWith(base)) ||
  targets.find((t) => t.url === 'about:blank') ||
  targets[0]
if (!page) throw new Error('没有找到可用的页面目标')

const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.addEventListener('open', res)
  ws.addEventListener('error', rej)
})

let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
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
await send('Emulation.setDeviceMetricsOverride', {
  width: Number(process.env.SHOT_W || 1440),
  height: Number(process.env.SHOT_H || 1180),
  deviceScaleFactor: 1,
  mobile: false,
})

mkdirSync('_shots', { recursive: true })

// 先落到目标源，后面才能操作它的 localStorage
await send('Page.navigate', { url: `${base}/` })
await sleep(1500)

const shots = await (async () => {
  try {
    const { readFileSync } = await import('node:fs')
    return JSON.parse(readFileSync('.tmp/shots.json', 'utf8'))
  } catch {
    return [
      { name: 'welcome', hash: '/welcome', loggedIn: false },
      { name: 'home', hash: '/', loggedIn: true },
      { name: 'circles', hash: '/circles', loggedIn: true },
      { name: 'match', hash: '/match', loggedIn: true },
      { name: 'me', hash: '/me', loggedIn: true },
    ]
  }
})()

for (const [i, s] of shots.entries()) {
  const target = `${base}/?v=${i}#${s.hash}`
  const useSeed = Boolean(seed) && s.loggedIn !== false
  if (useSeed) {
    await send('Runtime.evaluate', {
      expression: `localStorage.setItem('xiangyu.state.v2', ${JSON.stringify(seed)})`,
    })
  } else {
    await send('Runtime.evaluate', { expression: `localStorage.removeItem('xiangyu.state.v2')` })
  }
  // 只改 hash 不会重新加载，必须换 query 强制整页刷新，store 才会重新读 localStorage
  await send('Page.navigate', { url: target })
  await sleep(1600)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (!shot.result?.data) {
    console.log('截图失败', s.name, JSON.stringify(shot).slice(0, 200))
    continue
  }
  writeFileSync(`_shots/${s.name}.png`, Buffer.from(shot.result.data, 'base64'))
  console.log('saved', `_shots/${s.name}.png`)
}

ws.close()
