# 部署到 Cloudflare Pages（前后端一体，免费，国内可访问）

> 为什么选它：在你这里的网络实测，`pages.dev` 通、`supabase.co` 被 DNS 污染、`vercel/render/fly` 超时。
> 它免费、不用绑卡，静态站 + 后端函数 + KV 数据库都在一个项目里。

## 结构

```
GitHub 仓库
├── src/           前端（React）
├── server/ops.mjs 业务逻辑（Node 和 Cloudflare 共用同一份）
├── functions/api/[[path]].js   后端接口 /api/*
├── functions/uploads/[name].js 图片和资料下载
└── dist/          构建产物（部署时自动生成）
```

数据存在 **KV** 里：一份 `world`（用户/动态/消息）+ 若干 `file:*`（图片资料）。

---

## 第 1 步：注册 Cloudflare

1. <https://dash.cloudflare.com/sign-up> → 邮箱 + 密码（不用绑卡，不用域名）
2. 收邮件点验证链接

## 第 2 步：连 GitHub 建 Pages 项目

1. 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. 授权 GitHub → 选仓库 `SherlockYu2008/xiangyu` → **Begin setup**
3. 填写：

| 项 | 值 |
|---|---|
| Project name | `xiangyu` |
| Production branch | `main` |
| Framework preset | `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |

4. 点 **Save and Deploy**，等 2 分钟，拿到 `https://xiangyu.pages.dev`

> 这时网站能打开，但还没有数据库，点注册会报「缺少 KV 绑定 WORLD」——正常，下一步补。

## 第 3 步：建 KV 命名空间并绑定

1. 项目页面 → **Settings** → **Functions** → **KV namespace bindings** → **Add binding**
2. Variable name 填 **`WORLD`**（必须一字不差）
3. Namespace 点 **Create new**，名字随便（比如 `xiangyu-data`）
4. **Save**

## 第 4 步：设环境变量

1. **Settings** → **Environment variables** → **Add variable**
2. Name：`XY_SECRET`，Value：随便一串 30 位以上的字符（比如 `xy-9f2k3j8d7s6a5l4m3n2b1v0c9x8`）
3. 三个环境（Production / Preview）都加上，**Save**

## 第 5 步：重新部署

**Deployments** → 最新那条右边的 **⋯** → **Retry deployment**。

等它变绿，打开 `https://xiangyu.pages.dev`，注册第一个账号（自动是管理员）。

## 第 6 步：验证互通

1. 电脑注册「甲」
2. 手机切 4G，打开同一网址，注册「乙」
3. 电脑刷新（或等 8 秒轮询），「可能认识的人」里出现乙 → 通了

---

## 常见问题

**Q：为什么不是实时，要等几秒？**
Cloudflare Pages Functions 不支持长连接（SSE），所以退化成 8 秒轮询。想实时可以上 Cloudflare Workers + Durable Objects（要额外配置）。

**Q：数据会丢吗？**
KV 是持久存储，免费额度：每天 10 万次读、1000 次写。小规模校园使用足够。

**Q：能绑自己的域名吗？**
可以，Pages 免费支持自定义域名，域名本身要另买（几十块一年）。

**Q：本地怎么跑同样的后端？**
`node server/index.mjs` 用的是同一份 `server/ops.mjs`，只是存储换成文件。

**Q：怎么清空数据重来？**
KV 里删掉 `world` 这个 key，或者新建一个 KV 命名空间重新绑定。
