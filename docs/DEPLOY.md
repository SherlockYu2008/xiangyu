# 橡遇 XIANGYU · 部署指南（GitHub + Cloudflare Pages）

本文把「本地项目」发布到公网：前端放在 **Cloudflare Pages**，数据与登录放在 **Supabase**，AI 增强是可选的 **Supabase Edge Function + DeepSeek**。
如果 Supabase 还没配置，请先按 [`docs/SUPABASE.md`](./SUPABASE.md) 做数据库、登录、函数部署，再回来上线。

> **诚实说明**：以下命令、控制台路径和配置项是按常规发布流程编写的，尚未在真实的 GitHub 仓库、Cloudflare Pages 和正式域名上实际执行过。Cloudflare 和 Supabase 控制台会改版，首次部署请对照实际页面与官方文档；不要因为文档里写了某个按钮就认为它一定出现在同一位置。
>
> 如果 `git --version` 提示找不到命令，请先安装 [Git for Windows](https://git-scm.com/download/win)，安装后重开终端，确认命令可用再继续。

---

## 0. 上线前确认

- [ ] 本地 `npm run dev` 能打开页面（这一步由前端同学确认）。
- [ ] Supabase 项目已创建，`supabase/schema.sql` 已在测试项目执行。
- [ ] 本地 `.env.local` 已配置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
- [ ] 如果要用 AI：`ai-assist` 已部署，`DEEPSEEK_API_KEY` 已在 Supabase secrets 中设置。未开启时页面应展示本地 fallback，不应崩溃。
- [ ] 已阅读 `.gitignore`，确认 `.env`、`.env.local`、`node_modules`、`dist` 不会提交。
- [ ] 没有把 `SUPABASE_SERVICE_ROLE_KEY`、DeepSeek key 写入任何前端文件。

> 本项目 `vite.config.js` 里设置了 `base: './'`，构建产物使用相对路径，适合部署到 Pages 的根路径或子路径。不要随便改成 `/`，除非你确定静态资源的实际访问路径。

---

## 1. 在 GitHub 建仓库

1. 登录 <https://github.com>。
2. 右上角 **+ → New repository**。
3. 填写：
   - **Repository name**：例如 `xiangyu-campus`
   - **Description**：可选，例如“橡遇 · 青科大兴趣同频社交平台”
   - **Visibility**：Private 或 Public 都可以；Private 需要确认 Cloudflare 有该仓库的授权。
   - **Initialize this repository with**：不要勾选 README、.gitignore、License，因为本地已经有文件，勾了会制造一次不必要的合并。
4. 点击 **Create repository**。
5. 复制页面上的仓库地址，形如：
   - HTTPS：`https://github.com/<你的用户名>/xiangyu-campus.git`
   - 或 SSH：`git@github.com:<你的用户名>/xiangyu-campus.git`

如果这是你第一次使用 Git，建议先设置提交身份：

```powershell
git config --global user.name "你的名字或昵称"
git config --global user.email "你的GitHub注册邮箱"
```

---

## 2. 把本地代码推到 GitHub

在项目根目录 `E:\网站` 打开 PowerShell 执行。

### 2.1 初始化并检查

```powershell
git init
git branch -M main
git status --short
```

`git status --short` 应该列出 `index.html`、`package.json`、`src/`、`supabase/`、`docs/` 等；**不应该**出现 `.env`、`.env.local`、`node_modules`、`dist`。
还要注意工作区可能存在的本地工具产物，例如 `.edge-profile/`、`.npm-cache/`、`_shots/`、`_tools/`，以及运行 Supabase CLI 后生成的 `supabase/.temp/`。这些通常不是要发布的前端源码，提交前请逐个确认；不需要的话就不要 `git add .` 一把梭，或把它们加入 `.gitignore`。

可以专门验证环境变量文件是否被忽略：

```powershell
git check-ignore -v .env.local
```

如果输出 `.gitignore:...` 的规则说明它被忽略了。若命令没有任何输出，说明没被忽略，请先检查 `.gitignore`，不要把密钥提交上去。

### 2.2 提交并推送

```powershell
git add .
git commit -m "chore: 初始化橡遇项目"
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

推送时可能要求登录 GitHub。推荐使用 Git Credential Manager 或 Personal Access Token；不要把 token 写进远程 URL 后提交到任何文件。

如果 `git remote add` 提示 `remote origin already exists`，用：

```powershell
git remote set-url origin https://github.com/<你的用户名>/<仓库名>.git
```

### 2.3 密钥曾被提交过怎么办

如果发现 `.env`、`.env.local` 或含有 `DEEPSEEK_API_KEY`、`service_role` 的文件已经提交：

1. 立即到 Supabase **Project Settings → API** 轮换 service_role（或按官方方式重置），到 DeepSeek 控制台吊销旧 key。
2. 从 Git 索引移除文件：

   ```powershell
   git rm --cached .env .env.local
   git commit -m "chore: 移除误提交的本地环境变量"
   ```

3. `.gitignore` 只对未跟踪文件生效；**已经进入历史记录的 secret 必须视为泄露**。必要时使用 `git filter-repo` 或 GitHub 官方的敏感数据移除流程重写历史。不要只删当前文件就认为安全。

当前仓库的 `.gitignore` 已经包含：

```gitignore
node_modules
dist
dist-ssr
.DS_Store
*.local
.env
.env.local
.vscode/*
!.vscode/extensions.json
npm-debug.log*
```

> 不要为了“方便”把 `.env.local` 移除出 `.gitignore`。Cloudflare Pages 的环境变量会单独配置。

---

## 3. 部署到 Cloudflare Pages

### 3.1 创建 Pages 项目

1. 登录 <https://dash.cloudflare.com>。
2. 左侧进入 **Workers & Pages**（部分版本显示为 **Compute (Workers)** 或 **Workers and Pages**）。
3. 点击 **Create application** / **Create**。
4. 选择 **Pages** 选项卡，点击 **Connect to Git**。
5. 授权 Cloudflare 访问你的 GitHub 账号，只选择上面创建的仓库。若看不到仓库，检查 GitHub App 的仓库访问权限（仅选中的仓库是否包含它）。
6. 选择仓库，点击 **Begin setup**。

### 3.2 构建配置

填写：

| 配置项 | 填什么 |
| --- | --- |
| **Project name** | 例如 `xiangyu-campus`，会成为 `xxx.pages.dev` 的一部分 |
| **Production branch** | `main` |
| **Framework preset** | `Vite` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | 留空；本项目就是仓库根目录。若你以后改成 monorepo 再填子目录 |

如果页面出现 **Environment variables**，展开填写（Production 和 Preview 都建议填）：

```text
VITE_SUPABASE_URL = https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY = <你的 anon public / publishable key>
```

> **不要**在 Cloudflare 加 `SUPABASE_SERVICE_ROLE_KEY`、`DEEPSEEK_API_KEY` 为 `VITE_*` 变量。它们会被打包进浏览器。
> Supabase 的 DeepSeek secret 只属于 Edge Function，属于 Supabase 项目，不属于 Cloudflare 前端。

如构建因为 Node 版本失败，可在环境变量里加：

```text
NODE_VERSION = 20
```

Vite 6 需要 Node 18+；Cloudflare 的默认 Node 版本可能随平台调整。如果你的构建日志显示 Node 不兼容，再显式设置一个官方支持的 LTS（如 20/22），不要盲填旧版本。

### 3.3 首次部署

点击 **Save and Deploy**，等待构建完成。构建日志里应能看到：

```text
npm run build
vite build
...
✓ built in ...
```

成功后 Cloudflare 会给你两个地址：

- 生产地址：`https://<project-name>.pages.dev`
- 本次部署预览：形如 `https://<hash>.<project-name>.pages.dev`

以后每次向 `main` 推送代码，Pages 会自动重新构建；向其他分支推送通常会产生预览部署（取决于项目设置）。

> 构建时 Vite 会把 `VITE_*` 变量**写死到静态文件里**。改了环境变量之后，必须在 Cloudflare 里触发一次新的部署（Redeploy / Retry deployment）才生效，仅保存变量不会更新已生成的 JS。

### 3.4 构建失败的少量常见原因

| 构建日志现象 | 处理 |
| --- | --- |
| `vite: not found` / 依赖缺失 | 确认 Cloudflare 用的是 `npm run build`，且 `package.json` 在仓库根目录；`node_modules` 不应被提交 |
| Node 版本报错 | 设置 `NODE_VERSION` 为一个当前受支持的 LTS，重新部署 |
| `index.html` 引入 `/src/main.jsx` 但找不到 | 仓库根目录是否正确；不要上传只含部分文件的压缩包 |
| 页面空白但构建成功 | 环境变量没有在构建时提供，或填错 key；看浏览器 Console/Network，重新触发部署 |
| 403 访问 GitHub 仓库 | Cloudflare 的 GitHub App 没有该仓库权限；重新授权 |

---

## 4. 本项目使用 HashRouter：刷新深层链接不需要 `_redirects`

橡遇使用 **HashRouter**。典型 URL：

```text
https://你的域名/#/
https://你的域名/#/discover
https://你的域名/#/circles/sport
```

`#` 后面的部分只在浏览器中生效，**不会发送给 Cloudflare 的服务器**。因此：

- 服务器收到的永远是 `/` 或 `/index.html`。
- 刷新 `/#/circles/sport` 仍然能正常加载单页应用。
- 不需要 SPA fallback，也就不需要 `public/_redirects`。
- Pages 的 404 页面不会因为深层链接而被触发。

这一点和 BrowserRouter 不同。如果未来前端把 `HashRouter` 改成 `BrowserRouter`，URL 会变成：

```text
https://你的域名/profile/abc
```

这时刷新会直接向服务器请求 `/profile/abc`，静态托管默认找不到该文件，就会 404。那时需要在 Cloudflare Pages 配置 SPA 回退。

### 4.1 可选的 `public/_redirects` 做法（当前 HashRouter 不需要）

仅当你以后切换到 BrowserRouter，或确实需要把未匹配路径交给单页应用时，才创建 `public/_redirects`，内容为：

```text
/*    /index.html   200
```

说明：

- Cloudflare Pages 会把未匹配的路径 **rewrite** 到 `/index.html`，HTTP 状态码保持 200，而不是 301 跳转。
- 不要用 `301`/`302` 指向 `/index.html` 后再期望前端拿到原始路径；那会改变 URL 并可能丢失深链。
- 当前 HashRouter 下加了它也不会让 `#/` 失效，但属于多余配置。**不要为了“看起来完整”而添加一个当前不需要的文件。**
- 如果该文件存在，位置必须是 Vite 的静态目录 `public/_redirects`，构建后会进入 `dist/_redirects`；放在仓库根目录不会生效。
- 与 `_redirects` 同时存在 `404.html` 时规则可能有优先级差异；本项目不需要 SPA 回退，暂不要混用。

---

## 5. 自定义域

### 5.1 在 Cloudflare Pages 添加域名

1. 进入 Pages 项目，点击 **Custom domains**。
2. 点击 **Set up a custom domain**。
3. 输入你的域名，例如 `xiangyu.example.com`。
4. 如果域名已经托管在 Cloudflare：
   - Pages 通常会自动创建需要的 CNAME / DNS 记录；
   - 按提示确认即可。
5. 如果域名在别的注册商：
   - 按页面给出的目标，在 DNS 服务商添加 CNAME，指向 `<project-name>.pages.dev`；
   - 等待 DNS 生效。
6. 等待证书签发。HTTPS 证书由 Cloudflare 自动配置，可能需要几分钟。

推荐分配：

- 主域名或 `www` 指向 Pages。
- 把根域（apex）用 CNAME flattening 或 Cloudflare 的规则处理；不同 DNS 商支持不同，按 Cloudflare 的提示操作。
- 决定是否统一跳转到 `https://` 和 `www`，避免生成两个可登录来源。

### 5.2 域名上线后同步改这些地方

1. **Supabase → Authentication → URL Configuration**
   - Site URL 改成正式地址，如 `https://xiangyu.example.com`
   - Redirect URLs 加 `https://xiangyu.example.com/**`
   - 如果还保留 `pages.dev` 访问，也把它加入允许列表。
2. **Supabase Edge Function 的 `ALLOWED_ORIGIN`**
   - 如果之前是 `*`，建议收紧到正式域名和 `pages.dev`：
   ```powershell
   # 在项目根目录执行；多个 origin 用英文逗号分隔，不要带路径和末尾斜杠
   supabase secrets set ALLOWED_ORIGIN=https://xiangyu.example.com,https://<project-name>.pages.dev
   ```
   - 如果已部署过函数且新 secret 没生效，重新部署一次：
   ```powershell
   supabase functions deploy ai-assist
   ```
3. **DeepSeek secret 不要动**，它只在 Supabase 服务端。
4. 前端如果使用绝对 URL（例如分享链接、邮件模板）且写死 localhost，需要改成正式域名并重新构建部署。
5. 如果启用邮箱确认，测试一次“注册 → 收邮件 → 跳回正式域名 → 登录”。

> `ALLOWED_ORIGIN` 的匹配是精确 origin（协议 + 域名 + 端口），`https://example.com/` 和 `https://example.com` 在浏览器 Origin 头里通常不带末尾斜杠。不要写路径。

---

## 6. 上线后自检清单

以下每一项都应在**正式域名**上做一次，而不是只看 localhost。

### 6.1 基础访问

- [ ] 打开首页，页面样式、图片、字体正常，没有大片白屏。
- [ ] 浏览器 Console 没有持续红色报错。
- [ ] Network 中静态资源都是 200/304，没有因为 `base` 配错而 404。
- [ ] 手机尺寸下导航、按钮、输入框可用；安全区域没有遮挡底部栏。

### 6.2 刷新深层链接

- [ ] 登录后进入一个带 `#` 的深层页面（例如 `/#/circles/sport`）。
- [ ] 按 `F5` 刷新，页面仍能加载并显示正确内容，而不是 404 或跳回首页。
- [ ] 复制该 URL 到新标签页打开，行为一致。
- [ ] 若未来切到 BrowserRouter，这一项必须在配置 SPA 回退后重新测试。

### 6.3 注册、登录、资料

- [ ] 用一个全新的测试邮箱注册。
- [ ] 如果开启邮件确认，点击邮件链接能回到正式域名。
- [ ] 注册后 `profiles` 自动出现一行，昵称/年级/专业/校区正确；昵称长度没有超过 20 个字符。
- [ ] 退出后重新登录成功；刷新页面仍是登录状态（Supabase session 正常）。
- [ ] 编辑资料后刷新，修改仍在。
- [ ] 关闭 `searchable` 后，别人用学号搜索不到。

### 6.4 内容与社交流程

- [ ] 进入一个圈子，成功加入，圈子 `member_count` 增加 1。
- [ ] 发一条搭子帖，刷新后仍在；编辑/删除只有作者入口有效。
- [ ] 用另一个账号加入搭子帖，人数增加；达到 `capacity` 后状态变 `full`，再点加入提示已满。
- [ ] 退出搭子，人数减少，状态恢复合理。
- [ ] 发送好友申请，收件人能看到；接受后双方能看到好友关系。
- [ ] 建立 direct 会话，双方都能看到并收发消息；第三个账号看不到。
- [ ] 刷新聊天页面，最近消息仍在。

### 6.5 AI 可选增强

- [ ] `ai_enabled=false` 时调用 AI 功能，前端显示本地 fallback，不出现 JS 崩溃。
- [ ] 打开 AI 后，正常调用返回 200 并带 `fallback`。
- [ ] 快速连点两次，应出现 429（默认冷却 20 秒），前端能优雅提示。
- [ ] 连续调用达到个人上限（默认 5 次/天）后返回 429。
- [ ] 将 `ai_daily_budget_cny` 设为 `0` 测试时返回 402，前端仍显示 fallback。
- [ ] 函数日志中没有 DeepSeek key、JWT 或用户隐私正文。

### 6.6 安全检查

- [ ] 浏览器 DevTools → Sources，搜索 `service_role`、`sk-`、`SUPABASE_SERVICE_ROLE_KEY`，不应出现真实值。
- [ ] Network 请求只带 anon/publishable key 和当前用户 JWT；没有服务端密钥。
- [ ] 用未登录窗口尝试访问要求登录的页面/接口，应被拒绝而不是返回私有数据。
- [ ] 用第二个账号尝试读取第一个账号的 `profile_private`、私聊、AI 使用记录，应查不到。
- [ ] GitHub 仓库没有 `.env.local`；GitHub Secret Scanning 告警为 0。
- [ ] Cloudflare 和 Supabase 的账号都开启了两步验证（2FA）。

---

## 7. 成本说明

成本会随平台定价调整变化。以下数字来自平台官方页面，**查阅时间为 2026-11-04**；正式上线前务必再点开官网确认：

- Cloudflare Pages 限制：<https://developers.cloudflare.com/pages/platform/limits/>
- Supabase 定价：<https://supabase.com/pricing>
- DeepSeek 定价/公告：<https://api-docs.deepseek.com/quick_start/pricing>

### 7.1 Cloudflare Pages

按官方 Free 计划说明（2026-11-04 查阅）：

- **每月 500 次构建**，同一时间 1 个构建，单次构建 20 分钟超时；每月构建次数是最容易被小改动消耗的额度。
- 每个项目最多 **100 个自定义域**，账户最多 **100 个 Pages 项目**。
- 每个站点最多 **20,000 个文件**，单个文件最大 **25 MiB**。
- 静态站点请求/带宽通常不单独计费；HTTPS/CDN 默认包含。第三方域名注册费另计。
- 不提供正式 SLA。

省钱做法：

- 合并多次修改再推 `main`；
- 用本地构建/预览确认后再推送；
- 不在每次保存时都触发部署。
- 如果以后改用 Cloudflare Workers/Functions 承担动态接口，要单独查 Workers 的免费额度和计费，不要套用 Pages 静态托管的额度。

### 7.2 Supabase

按官方 Free 计划说明（2026-11-04 查阅）：

- 免费价格 **$0/月**，最多 **2 个活跃项目**；API 请求不限量。
- **500 MB 数据库**（共享 CPU / 500 MB RAM）。
- **5 GB 出站流量 + 5 GB 缓存出站流量**。
- **1 GB 文件存储**（本项目上传图片/文件前要评估，当前 schema 不含存储桶策略）。
- **50,000 月活用户（MAU）**。
- **500,000 次 Edge Function 调用/月**。
- 日志保留 1 天；**项目连续 1 周不活跃会被暂停**，需要手动恢复。
- 没有自动备份；正式运营前应评估 Pro 计划或自行备份。

免费项目适合开发和早期测试，不适合承诺可用性的正式运营。升级 Pro 会产生固定月费/计算费用，按官方定价为准。本项目主要读写 PostgreSQL，不上传大量文件时，数据库容量和项目保活通常是第一批限制。

### 7.3 Supabase Auth 的邮件额度

Supabase 自带的邮件服务有发送频率限制，适合测试，不适合大量正式注册。若上线后注册量上来，应改为自己的 SMTP（Authentication → SMTP Settings），否则可能出现“注册了但迟迟收不到验证邮件”。具体额度以 Supabase 官方文档和你项目当前计划为准。

### 7.4 DeepSeek：预算开关和价格

AI 是**可选增强**，普通社交流程不会调用 DeepSeek。代码里有 5 层成本控制：

1. `system_settings.ai_enabled` 总开关，默认 `false`。
2. 每人每日成功调用上限，默认 5 次。
3. 同一用户 20 秒冷却。
4. 全站每日成功调用上限，默认 300 次。
5. 全站每日预算，默认 1.5 元，按 `ai_usage.cost` 估算累加。

`ai_usage.cost` 使用代码中的常量估算：

- 输入：`0.5 元 / 百万 token`
- 输出：`2 元 / 百万 token`

这些常量在 `supabase/functions/ai-assist/index.ts` 顶部，**不是官方账单的保证值**；如果 DeepSeek 调价，需要同步修改常量，否则预算判断会失真。最终费用以 DeepSeek 控制台的用量账单为准。

真正省钱的做法：

- 不开 AI 也不影响“找搭子/聊天/圈子”；`ai_enabled=false` 是最彻底的开关。
- 缓存命中不写 `ai_usage`、不调用供应商；同一输入 7 天内复用。
- 不要把 `DEEPSEEK_API_KEY` 放进前端，否则任何人都可以绕过你的次数与预算限制直接消费。
- 在 DeepSeek 平台单独设置充值上限和余额告警，作为函数内部预算之外的第二道保险。
- 如果只做演示，把 `ai_daily_budget_cny` 设为 `0` 或保持 `ai_enabled=false`。

### 7.5 一次性/周期性成本

| 项目 | 费用 |
| --- | --- |
| GitHub 公开仓库 | 免费 |
| GitHub 私有仓库 | 免费额度内可用，限制随账号计划变化 |
| Cloudflare Pages | 有 Free 计划；构建次数等有上限 |
| Supabase | 有 Free 计划；正式运营建议评估 Pro |
| DeepSeek | 按 token 付费，建议设充值上限 |
| 自定义域名 | 每年域名注册费（可选） |

---

## 8. 更新与回滚

### 8.1 日常更新

```powershell
git add .
git commit -m "feat: 描述这次改动"
git push origin main
```

Cloudflare Pages 会自动构建新的生产部署。构建时用的环境变量来自 Pages 项目设置，不是本地 `.env.local`。

### 8.2 回滚前端

Cloudflare Pages 的 **Deployments** 页面保留历史部署。找到上一个成功版本，点击 **Rollback**（或 **Redeploy**）即可切换。注意：

- 回滚前端不会回滚数据库，也不会回滚 Edge Function。
- 如果新代码依赖新的表/策略/函数，先确保 Supabase 侧已存在对应结构，否则回滚 JS 可能仍然报错。
- Supabase schema 变更建议单独写迁移文件，不要直接重跑 `if not exists` 的初始化脚本当作升级。

### 8.3 回滚 Edge Function / 更换 key

```powershell
# 重新部署当前代码
supabase functions deploy ai-assist

# 轮换 DeepSeek key（先到 DeepSeek 控制台吊销旧 key）
supabase secrets set DEEPSEEK_API_KEY=sk-新的key
```

如果 AI 出现异常或费用异常，第一选择是关闭数据库开关：

```sql
update public.system_settings
set value = 'false'::jsonb, updated_at = now()
where key = 'ai_enabled';
```

前端应依赖返回的 `fallback`，这样 AI 关闭时功能降级而不是崩掉。

### 8.4 清理测试数据

在正式开放前，用 SQL Editor 清理测试账号/帖子/消息；不要直接删 `auth.users` 以外的零散行导致外键关系混乱。具体 SQL 取决于你的测试数据，执行前先在测试库演练并做好备份。

---

## 9. 故障排查（部署侧）

| 现象 | 优先检查 |
| --- | --- |
| `git` 不是内部或外部命令 | 安装 Git for Windows 并重开终端 |
| 推送提示权限拒绝 | 检查 GitHub 登录/Token；不要把 token 写进远程 URL 后共享 |
| Cloudflare 看不到 GitHub 仓库 | 重新配置 Cloudflare GitHub App，仅授权该仓库 |
| Pages 构建失败 | 看构建日志第一条错误；检查 Node 版本、根目录、`package.json` |
| 页面白屏 | 检查 Pages 环境变量、构建日志、浏览器 Console；环境变量改动后要重新部署 |
| 刷新深层链接 404 | 本项目用 HashRouter 不应出现；确认访问的是 `/#/...` 且没有把 `#` 后面截掉；若已切 BrowserRouter，加 `_redirects` |
| 登录邮件跳回 localhost | 改 Supabase Site URL/Redirect URLs，重新测试 |
| 登录后接口 401 | 检查 Supabase URL/key 是否来自同一个项目；查看 JWT 是否过期；检查 Edge Function 的 Authorization |
| AI CORS 错误 | 更新 Supabase `ALLOWED_ORIGIN` 为正式 origin；重新部署函数；不要带路径 |
| AI 402/429 | 到 `docs/SUPABASE.md` 第 8 节看预算/次数/冷却处理；这是限流设计，不是随机故障 |
| 正式域名能打开但 `pages.dev` 不行 | 检查自定义域和 DNS；两边都可能需要加入 Supabase Auth/CORS 白名单 |
| Supabase Free 突然不可用 | 项目可能被暂停；登录 Dashboard 恢复 |

---

## 10. 最终发布顺序（简化版）

1. 初始化 Supabase，执行 `schema.sql`。
2. 配置邮箱登录、URL 回调。
3. 部署 `ai-assist`、设置 `DEEPSEEK_API_KEY`（可选）。
4. 本地 `.env.local` 配好并本地验证。
5. 推送到 GitHub，确认没有 secret 被提交。
6. Cloudflare Pages 连接仓库，配置构建命令和环境变量，部署。
7. 绑定自定义域，同步 Supabase Auth URL 与 `ALLOWED_ORIGIN`。
8. 按第 6 节逐项自检。
9. 根据真实访问量决定是否升级套餐；先保持 AI 预算收紧。

祝上线顺利。遇到报错时优先保留**第一条**错误信息，而不是在多个平台上同时改配置。
