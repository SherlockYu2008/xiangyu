// 备份：把数据目录（消息、照片、账号）整包复制到 backups/ 下
// 用法：node scripts/backup-data.mjs
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.env.XY_DATA_DIR || join(process.cwd(), 'server', 'data')
const STAMP = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
const DEST = join(process.cwd(), 'backups', `data-${STAMP}`)

if (!existsSync(SRC)) {
  console.error('没有找到数据目录：', SRC)
  process.exit(1)
}

mkdirSync(DEST, { recursive: true })
cpSync(SRC, DEST, { recursive: true })

const size = (dir) => {
  let total = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    total += st.isDirectory() ? size(p) : st.size
  }
  return total
}

const bytes = size(DEST)
console.log(`已备份到 ${DEST}`)
console.log(`大小：${(bytes / 1024 / 1024).toFixed(2)} MB`)
console.log('提示：world.json 里是聊天、账号和文字内容，uploads/ 里是照片，两个都要。')
