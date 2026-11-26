// 文件下载：图片、资料都从 KV 里取（避免把 base64 塞进列表数据）
const MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  webm: 'video/webm', mp4: 'video/mp4', m4a: 'audio/mp4', ogg: 'audio/ogg', mp3: 'audio/mpeg', wav: 'audio/wav', mov: 'video/quicktime',
  pdf: 'application/pdf', txt: 'text/plain; charset=utf-8', zip: 'application/zip',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export async function onRequest(context) {
  const { request, env, params } = context
  const name = String(params.name || '').replace(/[^a-zA-Z0-9._-]/g, '')
  if (!name) return new Response('not found', { status: 404 })

  const raw = await env.WORLD.get('world')
  if (!raw) return new Response('not found', { status: 404 })

  let world
  try {
    world = JSON.parse(raw)
  } catch {
    return new Response('not found', { status: 404 })
  }

  const file = world.__files && world.__files[name]
  if (!file) return new Response('not found', { status: 404 })

  const bin = Uint8Array.from(atob(file.b64), (c) => c.charCodeAt(0))
  const ext = name.split('.').pop().toLowerCase()
  return new Response(bin, {
    headers: {
      'content-type': file.mime || MIME[ext] || 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
