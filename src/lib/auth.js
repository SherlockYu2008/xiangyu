// 账号密码的处理：只在本机做摘要，不发送到任何服务器。
// 注意：这是「本机账号」，不是银行级安全。真正上线请用 Supabase Auth。
const enc = new TextEncoder()

function toHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomSalt(len = 16) {
  const a = new Uint8Array(len)
  crypto.getRandomValues(a)
  return toHex(a)
}

// PBKDF2-SHA256，12 万次迭代。浏览器里通常 60~150ms。
async function pbkdf2(password, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' },
    key,
    256,
  )
  return toHex(bits)
}

// 非安全上下文（file:// 或某些 http 局域网地址）没有 SubtleCrypto，
// 退化成普通摘要——只够防止“朋友随手翻”，不是密码学保护。
function weakHash(str) {
  let h1 = 0x811c9dc5
  let h2 = 0x27d4eb2d
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4)
}

export async function hashPassword(password, salt) {
  if (globalThis.crypto?.subtle) {
    return { hash: await pbkdf2(password, salt), algo: 'pbkdf2-sha256-120k' }
  }
  return { hash: weakHash(`${salt}:${password}`), algo: 'weak-fallback' }
}

export function checkPassword(pw) {
  if (typeof pw !== 'string' || pw.length < 6) return '密码至少 6 位'
  if (pw.length > 72) return '密码太长了，72 位以内'
  if (/^\d+$/.test(pw) && pw.length < 8) return '纯数字密码至少要 8 位'
  return null
}

// 常见弱密码，撞库字典里的常客
const COMMON = new Set([
  '123456', '1234567', '12345678', '123456789', '1234567890', '123123', '111111',
  '000000', '666666', '888888', '88888888', '5201314', 'password', 'passw0rd',
  'qwerty', 'abc123', 'a123456', 'admin', 'iloveyou', 'woaini', 'woaini1314',
  'qwer1234', 'asd123', 'zxcvbnm', '1qaz2wsx',
])

/**
 * 注册时的密码强度校验。
 * 除了长度，还挡住「常见弱密码」和「把昵称/学号当密码」这两种最常见的盗号入口。
 */
export function strongPassword(pw, { nickname = '', studentNo = '' } = {}) {
  const base = checkPassword(pw)
  if (base) return base
  if (pw.length < 8) return '密码至少 8 位'
  const low = pw.toLowerCase()
  if (COMMON.has(low)) return '这个密码太常见了，换一个'
  if (nickname && low.includes(nickname.toLowerCase())) return '密码里不要放自己的昵称'
  if (studentNo && pw.includes(studentNo)) return '密码里不要放学号'
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((r) => r.test(pw)).length
  if (classes < 2) return '密码要至少包含两种字符（小写 / 大写 / 数字 / 符号）'
  return null
}

export function checkStudentNo(no) {
  if (!no) return null // 选填
  if (!/^\d{8,14}$/.test(no)) return '学号应该是 8–14 位数字'
  return null
}
