import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const CSP = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self' https://*.supabase.co",
  "font-src 'self' data:",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

// 只在打包产物里注入 CSP：开发时 Vite 自己会插内联脚本，注了会打不开 HMR。
function cspPlugin() {
  return {
    name: 'inject-csp',
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html
      return html.replace(
        '</head>',
        `  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  <meta name="referrer" content="strict-origin-when-cross-origin" />\n  </head>`,
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), cspPlugin()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
