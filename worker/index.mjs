// Cloudflare Workers 入口：把静态站点和接口合成一个 Worker
// - /api/*      → functions/api/[[path]].js
// - /uploads/*  → functions/uploads/[name].js
// - 其他         → 静态资源（dist）
import { onRequest as apiHandler } from '../functions/api/[[path]].js'
import { onRequest as uploadHandler } from '../functions/uploads/[name].js'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname

    if (path.startsWith('/api/')) {
      return apiHandler({ request, env, ctx, params: { path: path.slice(5).split('/').filter(Boolean) } })
    }

    if (path.startsWith('/uploads/')) {
      const name = path.slice('/uploads/'.length)
      return uploadHandler({ request, env, ctx, params: { name } })
    }

    return env.ASSETS.fetch(request)
  },
}
