// 业务操作：Node 服务和 Cloudflare Functions 共用同一份实现
// world 是当前数据对象，deps 提供 rid / persistFile / removeImage / isAdmin
export function createOps(world, deps) {
  const { rid, removeImage, isAdmin } = deps
  const persistImage = deps.persistFile
  return {
  'profile.update'(u, p) {
    Object.assign(u, p.patch || {})
  },
  // 给别人主页点赞：同一个人一天最多给同一个人点 10 个
  'profile.like'(u, p) {
    if (!p.toId || p.toId === u.id) return
    world.profileLikes = world.profileLikes || []
    if (p.id && world.profileLikes.some((l) => l.id === p.id)) return
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const today = world.profileLikes.filter((l) => l.fromId === u.id && l.toId === p.toId && l.at >= start.getTime()).length
    if (today >= 10) return { error: '今天给他点的赞到上限了' }
    world.profileLikes.unshift({ id: p.id || rid('pl'), fromId: u.id, toId: p.toId, at: Date.now() })
  },
  'post.create'(u, p) {
    if (!p.post?.text && !p.post?.images?.length) return
    const postId = p.post.id || rid('p')
    world.posts.unshift({
      id: postId, authorId: u.id, text: String(p.post.text || '').slice(0, 1000),
      images: (p.post.images || []).slice(0, 9).map((src, i) => persistImage(src, `${postId}_${i}`)),
      mood: p.post.mood || '', createdAt: Date.now(), likes: [], comments: [],
    })
  },
  'post.delete'(u, p) {
    for (const post of world.posts) {
      if (post.id === p.id && post.authorId === u.id) (post.images || []).forEach(removeImage)
    }
    world.posts = world.posts.filter((x) => !(x.id === p.id && x.authorId === u.id))
  },
  'post.like'(u, p) {
    const post = world.posts.find((x) => x.id === p.id)
    if (!post) return
    post.likes = post.likes.includes(u.id) ? post.likes.filter((x) => x !== u.id) : [...post.likes, u.id]
  },
  'post.comment'(u, p) {
    const post = world.posts.find((x) => x.id === p.id)
    const text = p.comment?.text ?? p.text
    if (!post || !text) return
    const id = p.comment?.id || rid('cm')
    if (post.comments.some((c) => c.id === id)) return
    post.comments.push({ id, from: u.id, text: String(text).slice(0, 300), at: Date.now() })
  },
  'album.create'(u, p) {
    if (!p.name || !p.id) return
    if (world.albums.some((a) => a.id === p.id)) return
    world.albums.unshift({ id: p.id, ownerId: u.id, name: String(p.name).slice(0, 20), createdAt: Date.now(), photos: [] })
  },
  'album.photo'(u, p) {
    const a = world.albums.find((x) => x.id === p.albumId && x.ownerId === u.id)
    if (!a || !p.photo?.dataUrl || a.photos.length >= 24) return
    const id = p.photo.id || rid('ph')
    a.photos.push({
      id,
      url: persistImage(p.photo.dataUrl, id),
      caption: String(p.photo.caption || '').slice(0, 60),
      at: Date.now(),
    })
  },
  'album.delete'(u, p) {
    for (const a of world.albums) {
      if (a.id === p.id && a.ownerId === u.id) (a.photos || []).forEach((ph) => removeImage(ph.url))
    }
    world.albums = world.albums.filter((x) => !(x.id === p.id && x.ownerId === u.id))
  },
  'album.photo.delete'(u, p) {
    const a = world.albums.find((x) => x.id === p.albumId && x.ownerId === u.id)
    if (!a) return
    const target = a.photos.find((ph) => ph.id === p.photoId)
    if (target) removeImage(target.url)
    a.photos = a.photos.filter((ph) => ph.id !== p.photoId)
  },
  'guestbook.delete'(u, p) {
    world.guestbook = world.guestbook.filter((g) => !(g.id === p.id && (g.fromId === u.id || g.hostId === u.id)))
  },
  'diary.create'(u, p) {
    const d = p.diary || p
    if (!d.title || !d.body) return
    if (d.id && world.diaries.some((x) => x.id === d.id)) return
    world.diaries.unshift({
      id: d.id || rid('d'), authorId: u.id, title: String(d.title).slice(0, 60), body: String(d.body).slice(0, 8000),
      createdAt: Date.now(), likes: [], comments: [],
    })
  },
  'diary.delete'(u, p) {
    world.diaries = world.diaries.filter((x) => !(x.id === p.id && x.authorId === u.id))
  },
  'diary.like'(u, p) {
    const d = world.diaries.find((x) => x.id === p.id)
    if (!d) return
    d.likes = d.likes.includes(u.id) ? d.likes.filter((x) => x !== u.id) : [...d.likes, u.id]
  },
  'diary.comment'(u, p) {
    const d = world.diaries.find((x) => x.id === p.id)
    if (!d || !p.text) return
    d.comments.push({ id: rid('cm'), from: u.id, text: String(p.text).slice(0, 300), at: Date.now() })
  },
  'guestbook.write'(u, p) {
    if (!p.hostId || !p.text || p.hostId === u.id) return
    const id = p.id || rid('g')
    if (world.guestbook.some((g) => g.id === id)) return
    world.guestbook.unshift({ id, hostId: p.hostId, fromId: u.id, text: String(p.text).slice(0, 300), at: Date.now() })
  },
  'visit'(u, p) {
    if (!p.hostId || p.hostId === u.id) return
    if (world.visits.some((v) => v.hostId === p.hostId && v.visitorId === u.id && Date.now() - v.at < 60000)) return
    world.visits = [{ hostId: p.hostId, visitorId: u.id, at: Date.now() }, ...world.visits].slice(0, 500)
  },
  'friend.request'(u, p) {
    if (!p.toId || p.toId === u.id) return
    if (p.id && world.requestLog.some((r) => r.id === p.id)) return
    if (world.friendPairs.some((f) => (f.a === u.id && f.b === p.toId) || (f.b === u.id && f.a === p.toId))) return
    if (world.requestLog.some((r) => r.fromId === u.id && r.toId === p.toId && r.status === 'pending')) return
    world.requestLog.unshift({ id: p.id || rid('r'), fromId: u.id, toId: p.toId, note: String(p.note || '').slice(0, 200), at: Date.now(), status: 'pending' })
  },
  'friend.accept'(u, p) {
    const r = world.requestLog.find((x) => x.id === p.id && x.toId === u.id)
    if (!r) return
    r.status = 'accepted'
    const [a, b] = [r.fromId, r.toId].sort()
    if (!world.friendPairs.some((f) => f.a === a && f.b === b)) world.friendPairs.push({ a, b })
  },
  'friend.remove'(u, p) {
    world.friendPairs = world.friendPairs.filter((f) => !((f.a === u.id && f.b === p.peerId) || (f.b === u.id && f.a === p.peerId)))
  },
  'chat.start'(u, p) {
    if (!p.peerId || p.peerId === u.id) return {}
    const exist = world.convStore.conversations.find((c) => c.members.includes(u.id) && c.members.includes(p.peerId))
    if (exist) return { convId: exist.id }
    const c = { id: p.id || rid('c'), members: [u.id, p.peerId], unread: {}, lastAt: Date.now() }
    world.convStore.conversations.unshift(c)
    world.convStore.messages[c.id] = []
    return { convId: c.id }
  },
  'chat.send'(u, p) {
    const c = world.convStore.conversations.find((x) => x.id === p.convId && x.members.includes(u.id))
    const body = p.message?.body ?? p.body
    if (!c || !body) return
    const id = p.message?.id || rid('m')
    const list = world.convStore.messages[c.id] || []
    if (list.some((m) => m.id === id)) return
    const msg = { id, from: u.id, body: String(body).slice(0, 2000), at: Date.now() }
    world.convStore.messages[c.id] = [...list, msg]
    c.lastAt = msg.at
    c.members.forEach((m) => {
      if (m !== u.id) c.unread[m] = (c.unread[m] || 0) + 1
    })
    c.unread[u.id] = 0
  },
  'chat.read'(u, p) {
    const c = world.convStore.conversations.find((x) => x.id === p.convId && x.members.includes(u.id))
    if (c) c.unread[u.id] = 0
  },
  'buddy.create'(u, p) {
    if (!p.title) return
    if (p.id && world.buddies.some((x) => x.id === p.id)) return
    world.buddies.unshift({
      id: p.id || rid('b'), circle: p.circle, title: String(p.title).slice(0, 60), author: u.id,
      time: String(p.time || '').slice(0, 40), place: String(p.place || '').slice(0, 40),
      capacity: Math.min(50, Math.max(2, Number(p.capacity) || 4)), members: [u.id],
      tags: (p.tags || []).slice(0, 3), intro: String(p.intro || '').slice(0, 200), createdAt: Date.now(),
    })
  },
  'buddy.join'(u, p) {
    const b = world.buddies.find((x) => x.id === p.id)
    if (!b || b.members.includes(u.id) || b.members.length >= b.capacity) return
    b.members.push(u.id)
  },
  'buddy.leave'(u, p) {
    const b = world.buddies.find((x) => x.id === p.id)
    if (b) b.members = b.members.filter((m) => m !== u.id)
  },
  'circle.join'(u, p) {
    const list = world.circleMembers[u.id] || []
    if (list.includes(p.slug)) return
    world.circleMembers[u.id] = [...list, p.slug]
    const c = world.circles.find((x) => x.slug === p.slug)
    if (c) c.members += 1
  },
  'circle.leave'(u, p) {
    const list = world.circleMembers[u.id] || []
    if (!list.includes(p.slug)) return
    world.circleMembers[u.id] = list.filter((s) => s !== p.slug)
    const c = world.circles.find((x) => x.slug === p.slug)
    if (c) c.members = Math.max(0, c.members - 1)
  },

  /* ---------------- 学习资料 ---------------- */

  'material.create'(u, p) {
    const m = p.material
    if (!m?.title || !m?.dataUrl) return
    if (m.id && world.materials.some((x) => x.id === m.id)) return
    const id = m.id || rid('mat')
    world.materials.unshift({
      id,
      ownerId: u.id,
      title: String(m.title).slice(0, 60),
      course: String(m.course || '').slice(0, 20),
      desc: String(m.desc || '').slice(0, 200),
      url: persistFile(m.dataUrl, id),
      size: Number(m.size) || 0,
      kind: String(m.fileName || '').split('.').pop().slice(0, 6).toLowerCase(),
      downloads: 0,
      createdAt: Date.now(),
    })
  },
  'material.delete'(u, p) {
    const t = world.materials.find((x) => x.id === p.id)
    if (!t) return
    if (t.ownerId !== u.id && !isAdmin(u)) return
    removeImage(t.url)
    world.materials = world.materials.filter((x) => x.id !== p.id)
  },
  'material.download'(u, p) {
    const t = world.materials.find((x) => x.id === p.id)
    if (t) t.downloads = (t.downloads || 0) + 1
  },

  /* ---------------- 管理员 ---------------- */

  'admin.post.delete'(u, p) {
    if (!isAdmin(u)) return
    for (const post of world.posts) {
      if (post.id === p.id) (post.images || []).forEach(removeImage)
    }
    world.posts = world.posts.filter((x) => x.id !== p.id)
  },
  'admin.comment.delete'(u, p) {
    if (!isAdmin(u)) return
    const post = world.posts.find((x) => x.id === p.postId)
    if (post) post.comments = post.comments.filter((c) => c.id !== p.commentId)
  },
  'admin.album.delete'(u, p) {
    if (!isAdmin(u)) return
    for (const a of world.albums) {
      if (a.id === p.id) (a.photos || []).forEach((ph) => removeImage(ph.url))
    }
    world.albums = world.albums.filter((a) => a.id !== p.id)
  },
  'admin.diary.delete'(u, p) {
    if (!isAdmin(u)) return
    world.diaries = world.diaries.filter((d) => d.id !== p.id)
  },
  'admin.post.pin'(u, p) {
    if (!isAdmin(u)) return
    const post = world.posts.find((x) => x.id === p.id)
    if (post) post.pinned = Boolean(p.pinned)
  },
  'admin.user.ban'(u, p) {
    if (!isAdmin(u) || p.id === u.id) return
    const target = world.users.find((x) => x.id === p.id)
    if (target && target.role !== 'admin') {
      target.banned = true
      target.bannedAt = Date.now()
    }
  },
  'admin.user.unban'(u, p) {
    if (!isAdmin(u)) return
    const target = world.users.find((x) => x.id === p.id)
    if (target) {
      target.banned = false
      delete target.bannedAt
    }
  },
  'admin.announce'(u, p) {
    if (!isAdmin(u)) return
    const text = String(p.text || '').trim()
    world.announcement = text ? { text: text.slice(0, 120), at: Date.now(), by: u.nickname } : null
  },
  'admin.role'(u, p) {
    if (!isAdmin(u) || p.id === u.id) return
    const target = world.users.find((x) => x.id === p.id)
    if (target) target.role = p.role === 'admin' ? 'admin' : 'user'
  },
}

/* ---------------- HTTP ---------------- */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon', '.json': 'application/json; charset=utf-8'   }
}
