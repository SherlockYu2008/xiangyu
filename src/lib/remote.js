// 直连 Supabase：没有自己的服务器时，前端直接用 anon key 读写一个 JSON 行
// 注意：anon key 是公开的，所以数据库里所有内容对拿到网址的人都是可读的，
// 只适合校园演示；正式产品应改成服务端鉴权。

const URL = import.meta.env.VITE_SB_URL || ''
const KEY = import.meta.env.VITE_SB_KEY || ''

export const isRemote = () => Boolean(URL && KEY)

const headers = () => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
})

/** 拉取整份数据，没有就返回 null */
export async function pullWorld() {
  const res = await fetch(`${URL}/rest/v1/world?id=eq.1&select=data`, {
    headers: headers(),
  })
  if (!res.ok) throw new Error(`读取失败 HTTP ${res.status}`)
  const rows = await res.json()
  return rows?.[0]?.data || null
}

/** 整份覆盖写入（upsert），失败会抛错 */
export async function pushWorld(data) {
  const res = await fetch(`${URL}/rest/v1/world?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: 1, data, updated_at: new Date().toISOString() }),
  })
  if (!res.ok) throw new Error(`写入失败 HTTP ${res.status}`)
}

/** 只取 updated_at，用来判断远端有没有变 */
export async function pullStamp() {
  const res = await fetch(`${URL}/rest/v1/world?id=eq.1&select=updated_at`, {
    headers: headers(),
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows?.[0]?.updated_at || null
}
