// 把某个昵称设为管理员：node server/admin.mjs 雨时
// 取消：node server/admin.mjs 雨时 --revoke
// 列表：node server/admin.mjs --list
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FILE = join(ROOT, 'server', 'data', 'world.json')

if (!existsSync(FILE)) {
  console.error('还没有数据文件，先启动一次服务并注册账号。')
  process.exit(1)
}

const world = JSON.parse(readFileSync(FILE, 'utf8'))
const [, , name, flag] = process.argv

if (!name || name === '--list') {
  console.log('当前账号：')
  for (const u of world.users) {
    console.log(`  ${u.role === 'admin' ? '★' : ' '} ${u.nickname}${u.banned ? '（已封禁）' : ''}  ${u.id}`)
  }
  process.exit(0)
}

const user = world.users.find((u) => u.nickname === name)
if (!user) {
  console.error(`没找到昵称「${name}」。可用 --list 看全部账号。`)
  process.exit(1)
}

user.role = flag === '--revoke' ? 'user' : 'admin'
writeFileSync(FILE, JSON.stringify(world))
console.log(`${user.nickname} 现在是${user.role === 'admin' ? '管理员 ★' : '普通用户'}`)
console.log('如果服务正在运行，需要重启一次才会读取新权限。')
