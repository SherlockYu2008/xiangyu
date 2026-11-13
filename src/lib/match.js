// 纯前端匹配算法：Jaccard 相似度 + 加权规则评分。
// 全部是普通程序逻辑，不调用任何 AI，也不产生费用。

export function jaccard(a = [], b = []) {
  const A = new Set(a)
  const B = new Set(b)
  if (A.size === 0 && B.size === 0) return 0
  let inter = 0
  A.forEach((x) => {
    if (B.has(x)) inter += 1
  })
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

export function sharedTags(a = [], b = []) {
  const B = new Set(b)
  return a.filter((x) => B.has(x))
}

// 混合相似度：Jaccard 偏严格，重叠系数偏宽松，各取一半算「感觉」更像人
export function similarity(a = [], b = []) {
  if (!a.length || !b.length) return 0
  const B = new Set(b)
  let inter = 0
  a.forEach((x) => {
    if (B.has(x)) inter += 1
  })
  if (!inter) return 0
  const union = new Set([...a, ...b]).size
  return 0.55 * (inter / union) + 0.45 * (inter / Math.min(a.length, b.length))
}

export function overlap(a = [], b = []) {
  return jaccard(a, b)
}

// 兴趣同频：标签为主，话题/校区/年级/交流风格做修正
export function interestScore(me, other) {
  if (!me || !other) return 0
  const tag = similarity(me.tags, other.tags)
  const topic = similarity(me.topics, other.topics)
  const campus = me.campus === other.campus ? 1 : 0
  const grade = me.grade === other.grade ? 1 : 0
  const style = me.style && me.style === other.style ? 1 : 0
  const raw = 40 + tag * 52 + topic * 6 + campus * 3 + grade * 2 + style * 2
  return Math.round(Math.min(99, Math.max(35, raw)))
}

// 深度同频：权重可调
export function deepScore(me, other, prefs = {}, weights = { tag: 0.5, topic: 0.2, style: 0.15, depth: 0.15 }) {
  if (!me || !other) return { total: 0, parts: {} }
  const tag = similarity(prefs.tags?.length ? prefs.tags : me.tags, other.tags)
  const topic = similarity(prefs.topics?.length ? prefs.topics : me.topics, other.topics)
  const style = !prefs.style || prefs.style === other.style ? 1 : 0
  const target = Number(prefs.depth || me.depth || 3)
  const depth = 1 - Math.abs(target - (other.depth || 3)) / 4
  const parts = {
    兴趣相似: Math.round(tag * 100),
    话题重合: Math.round(topic * 100),
    交流偏好: Math.round(style * 100),
    讨论深度: Math.round(Math.max(0, depth) * 100),
  }
  const mixed =
    tag * weights.tag + topic * weights.topic + style * weights.style + Math.max(0, depth) * weights.depth
  return { total: Math.round(Math.min(99, 30 + mixed * 62)), parts }
}

// 推荐理由：模板生成，不调用 AI
export function reasons(me, other, limit = 2) {
  if (!me || !other) return []
  const out = []
  const shared = sharedTags(me.tags, other.tags)
  if (shared.length) out.push(`你们都喜欢 ${shared.slice(0, 3).join('、')}`)
  if (me.campus === other.campus) out.push(`同在${me.campus}，约起来不用跨校区`)
  if (me.grade === other.grade) out.push(`都是${me.grade}，作息大概率对得上`)
  if (me.style && me.style === other.style) out.push(`交流风格都是「${me.style}」，不容易聊尬`)
  if (!out.length) out.push('兴趣互补，也许能聊出点新东西')
  return out.slice(0, limit)
}

export function rankMatches(me, people) {
  return people
    .filter((p) => p.id !== me?.id)
    .map((p) => ({ person: p, score: interestScore(me, p) }))
    .sort((a, b) => b.score - a.score)
}

export function rankDeep(me, people, prefs) {
  return people
    .filter((p) => p.id !== me?.id)
    .map((p) => ({ person: p, ...deepScore(me, p, prefs) }))
    .sort((a, b) => b.total - a.total)
}

export function pickRandom(people, exclude = []) {
  const pool = people.filter((p) => !exclude.includes(p.id))
  if (!pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
