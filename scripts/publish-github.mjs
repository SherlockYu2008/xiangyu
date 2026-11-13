// 用 GitHub API 发布：建仓库 → 推源码(main) → 推静态站点(gh-pages) → 开 Pages
// 用法：GITHUB_TOKEN=ghp_xxx node scripts/publish-github.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const TOKEN = process.env.GITHUB_TOKEN
const REPO = process.env.GH_REPO || 'xiangyu'
const API = 'https://api.github.com'

if (!TOKEN) {
  console.error('缺少 GITHUB_TOKEN')
  process.exit(1)
}

const gh = async (path, opts = {}) => {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let data = {}
  try {
    data = text ? JSON.parse(text) : {}
  } catch {
    data = { raw: text }
  }
  return { status: res.status, data }
}

function walk(dir, root = dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) out.push(...walk(p, root))
    else out.push({ path: relative(root, p).split(sep).join('/'), content: readFileSync(p) })
  }
  return out
}

const withRetry = async (label, fn, tries = 4) => {
  let last
  for (let i = 0; i < tries; i += 1) {
    last = await fn()
    if (last.status < 400) return last
    console.log(`  ${label} 失败(${last.status})，重试 ${i + 1}/${tries}…`)
    await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
  }
  throw new Error(`${label} 失败：${JSON.stringify(last.data).slice(0, 300)}`)
}

// 1. 身份
const me = await gh('/user')
if (me.status !== 200) {
  console.error('token 无效：', me.status, JSON.stringify(me.data).slice(0, 200))
  process.exit(1)
}
const OWNER = me.data.login
console.log(`账号：${OWNER}`)

// 2. 建仓库（已存在就复用）
let repoRes = await gh(`/repos/${OWNER}/${REPO}`)
if (repoRes.status === 404) {
  repoRes = await withRetry('建仓库', () =>
    gh('/user/repos', { method: 'POST', body: { name: REPO, private: false, auto_init: false, description: '橡遇 XIANGYU · 青科大兴趣同频 / 学习圈与资料分享' } }),
  )
  console.log(`已创建仓库 https://github.com/${OWNER}/${REPO}`)
} else {
  console.log(`仓库已存在，复用 https://github.com/${OWNER}/${REPO}`)
}

const isText = (buf) => !buf.includes(0)

// 空仓库没法直接建 tree，先用 Contents API 提一个 README 把 git 仓库初始化出来
const seed = await gh(`/repos/${OWNER}/${REPO}/contents/README.md`)
if (seed.status === 404) {
  await withRetry('初始化仓库', () =>
    gh(`/repos/${OWNER}/${REPO}/contents/README.md`, {
      method: 'PUT',
      body: { message: 'init', content: Buffer.from('# 橡遇\n').toString('base64') },
    }),
  )
  console.log('已初始化仓库（首个提交）')
}
const head = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/main`)
const parent = head.status === 200 ? head.data.object.sha : null

const makeCommit = async (label, branch, files) => {
  const tree = files.map((f) => ({
    path: f.path,
    mode: '100644',
    type: 'blob',
    content: f.content.toString('utf8'),
  }))
  const treeRes = await withRetry(`${label} tree`, () => gh(`/repos/${OWNER}/${REPO}/git/trees`, { method: 'POST', body: { tree } }))
  const commitRes = await withRetry(`${label} commit`, () =>
    gh(`/repos/${OWNER}/${REPO}/git/commits`, {
      method: 'POST',
      body: {
        message: `${label}：${new Date().toISOString().slice(0, 10)}`,
        tree: treeRes.data.sha,
        parents: parent ? [parent] : [],
      },
    }),
  )
  const refPath = `/repos/${OWNER}/${REPO}/git/refs`
  const exist = await gh(`${refPath}/heads/${branch}`)
  if (exist.status === 200) {
    await withRetry(`${label} 更新分支`, () => gh(`${refPath}/heads/${branch}`, { method: 'PATCH', body: { sha: commitRes.data.sha, force: true } }))
  } else {
    await withRetry(`${label} 建分支`, () => gh(refPath, { method: 'POST', body: { ref: `refs/heads/${branch}`, sha: commitRes.data.sha } }))
  }
  console.log(`  ${branch}: ${files.length} 个文件`)
}

// 3. main = 源码
const source = walk('deploy/xiangyu')
const bad = source.filter((f) => !isText(f.content))
if (bad.length) {
  console.error('有二进制文件，需要改走 blob 接口：', bad.map((b) => b.path))
  process.exit(1)
}
console.log(`源码 ${source.length} 个文件`)
await makeCommit('源码', 'main', source)

// 4. gh-pages = 打包好的站点
const site = walk('dist')
await makeCommit('站点', 'gh-pages', site)

// 5. 开 Pages
let pages = await gh(`/repos/${OWNER}/${REPO}/pages`)
if (pages.status === 404) {
  pages = await gh(`/repos/${OWNER}/${REPO}/pages`, {
    method: 'POST',
    body: { source: { branch: 'gh-pages', path: '/' } },
  })
  console.log('Pages 已开启：', pages.status)
} else {
  await gh(`/repos/${OWNER}/${REPO}/pages`, { method: 'PUT', body: { source: { branch: 'gh-pages', path: '/' } } })
  console.log('Pages 已更新')
}

const url = `https://${OWNER}.github.io/${REPO}/`
console.log('')
console.log('仓库：https://github.com/' + OWNER + '/' + REPO)
console.log('网址：' + url)
console.log('（首次构建需要 1–3 分钟）')
