# 橡遇 XIANGYU · Supabase 后端配置指南

这份文档写给第一次使用 Supabase 的同学。按顺序做，每一步都给出控制台位置和命令。
Supabase 控制台会改版，按钮文字可能略有变化；如果找不到，优先在项目的 **Project Settings**、**Authentication**、**Edge Functions**、**SQL Editor** 里找。

> **诚实说明**：仓库里的 `supabase/schema.sql` 和 `supabase/functions/ai-assist/index.ts` 是按当前需求编写的，尚未在真实 Supabase 项目上执行、部署和联调过。第一次操作请留意报错，先在测试项目验证，再用于正式环境。本文不宣称这些步骤已经在真实环境跑通。

---

## 0. 开始前准备

你需要：

- 一个邮箱账号（注册 Supabase、登录 DeepSeek 用）。
- 项目的两个前端环境变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
- 如果要部署 AI 函数：安装 Supabase CLI，并准备一个 DeepSeek API Key。
- 不需要把数据库密码、service_role key 或 DeepSeek key 告诉前端同学以外的任何人；其中 **service_role key 和 DeepSeek key 绝对不能进入浏览器**。

本项目会用到三个服务：

| 服务 | 用途 | 免费与否 |
| --- | --- | --- |
| Supabase | 数据库、登录、RLS、Edge Function | 有 Free 计划，超额或长期不活跃会受限 |
| Cloudflare Pages | 托管前端静态文件 | 有 Free 计划 |
| DeepSeek API | 可选的 AI 增强 | 按 token 付费，代码内有预算限制 |

---

## 1. 创建 Supabase 项目

1. 打开 <https://supabase.com/dashboard>，用 GitHub 或邮箱登录。
2. 点击绿色的 **New project**。
3. 选择组织（第一次会自动创建一个默认组织），填写：
   - **Name**：例如 `xiangyu-campus`
   - **Database Password**：生成一个强密码并立刻保存到密码管理器。后面自托管或 CLI 可能用到。
   - **Region**：选离青岛较近的区域，例如 `Southeast Asia (Singapore)`；区域创建后通常不能随意改。
   - **Plan**：先选 **Free**。
4. 点击 **Create new project**，等待约 1～3 分钟完成初始化。

> Free 项目长时间没有请求会被暂停，之后需要到控制台手动恢复。正式运营不要依赖 Free 的可用性。

### 记下项目 Reference ID

进入 **Project Settings（左下角齿轮） → General**，找到 **Reference ID**，形如 `abcdefghijklmnop`。
后续 CLI 的 `<PROJECT_REF>` 就是它。

---

## 2. 复制 URL 和 anon key

1. 左侧点击 **Project Settings（齿轮）**。
2. 进入 **API**（部分新项目叫 **API Keys**）。
3. 复制：
   - **Project URL**：形如 `https://<project-ref>.supabase.co`
   - **anon public** key。新版项目可能显示为 **Publishable key**（`sb_publishable_...`），把它填入前端的 anon 变量即可。
   - 如果需要显示旧版 key：页面上通常有 **Legacy API keys** / **Reveal**。

**不要复制 `service_role` / `secret` key 到任何前端文件。** 它绕过 RLS，等于数据库管理员密码。

这两个值稍后会写进项目根目录的 `.env.local`。

---

## 3. 在 SQL Editor 初始化数据库

### 3.1 执行 schema.sql

1. 左侧点击 **SQL Editor**。
2. 点击 **New query**。
3. 用文本编辑器打开本仓库的 `supabase/schema.sql`，**整段复制**。
4. 粘贴到 SQL Editor，点击 **Run**（或按 `Ctrl + Enter`）。
5. 看到 **Success. No rows returned** 一般表示执行完成（会有一些 notice，正常）。

`schema.sql` 的设计：

- 整个脚本包在 `begin; ... commit;` 中，中间任何一句报错都会整体回滚。
- 已存在同名表时不会重建；但也不会自动补充旧表缺少的列，所以**不要拿它当迁移工具**。如果之前建过残缺的表，先在测试项目确认，必要时另写迁移或清空测试库重来。
- 策略全部是 `drop policy if exists ...` + `create policy ...`，可在空库/已初始化的库上重复执行。
- 种子兴趣和圈子使用 `on conflict do nothing`，不会覆盖你后来改过的数据。

### 3.2 快速确认表和数据

在 SQL Editor 新开一个查询，依次执行：

```sql
-- 应该能看到 21 张业务表（含 student_lookup_attempts）
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 12 个兴趣
select count(*) as interest_count from public.interests;

-- 8 个圈子；slug 必须为 study/sport/art/tech/game/food/outdoor/volunteer
select slug, name, emoji, member_count
from public.circles
order by name;

-- AI 设置：默认 ai_enabled = false，不手动打开不会产生 DeepSeek 费用
select key, value, updated_at
from public.system_settings
order by key;
```

预期：12 个兴趣、8 个圈子。若数量不对，重新检查 SQL Editor 是否有红色报错。

### 3.3 重要：AI 默认关闭

`system_settings.ai_enabled` 的种子值是 `false`。想开启 AI 时，在 SQL Editor 执行：

```sql
insert into public.system_settings (key, value)
values ('ai_enabled', 'true'::jsonb)
on conflict (key) do update
set value = excluded.value, updated_at = now();
```

关闭 AI：

```sql
update public.system_settings
set value = 'false'::jsonb, updated_at = now()
where key = 'ai_enabled';
```

只允许 service_role 写 `system_settings`，所以**不要用浏览器 anon key 去改它**；在 SQL Editor 用管理员身份改即可。

可调设置项：

| key | 默认值 | 说明 |
| --- | --- | --- |
| `ai_enabled` | `false` | AI 总开关 |
| `ai_daily_user_limit` | `5` | 每人每个北京时间自然日的调用次数 |
| `ai_cooldown_seconds` | `20` | 同一用户两次调用的最小间隔 |
| `ai_daily_global_limit` | `300` | 全站每天最多成功调用次数 |
| `ai_daily_budget_cny` | `1.5` | 全站每天预算（人民币，按 ai_usage.cost 累加） |

改完立即生效（每次请求都会重新读取设置）。`cost` 是按 token 估算的预算值，以 DeepSeek 实际账单为准。

---

## 4. 开启邮箱登录

1. 左侧点击 **Authentication**。
2. 进入 **Sign In / Providers**（不同版本可能叫 **Providers**）。
3. 找到 **Email**，确认 **Enable Email provider** 是开启状态。
4. 决定是否开启 **Confirm email**：
   - 开发阶段为了快速测试，可以暂时关闭，注册后直接登录。
   - 上线前建议开启，并要求真实邮箱。
5. 点击 **Save**。

### 4.1 配置跳转地址

1. **Authentication → URL Configuration**。
2. **Site URL**：
   - 本地开发：`http://localhost:5173`
   - 上线后改为正式域名，如 `https://xiangyu.example.com`
3. **Redirect URLs** 加入允许的地址，例如：
   - `http://localhost:5173/**`
   - `http://127.0.0.1:5173/**`
   - `https://你的域名/**`

本项目使用 HashRouter。邮箱确认/找回密码的邮件跳回根地址即可，`#/xxx` 由浏览器前端处理；如果跳回后路由不对，把 Site URL 改成站点根地址，不要把 `#/` 写进 Supabase 的 URL 配置里。

> Supabase 的邮箱登录默认不会限制必须是 `@qust.edu.cn`。如果产品要求校园邮箱限制，需要额外的服务端校验/Hook，当前 schema 没有做学校邮箱域判断。

---

## 5. 部署 ai-assist Edge Function

这一节需要安装 Supabase CLI。Windows 可选：

```powershell
# 任选一种；本仓库开发时没有替你执行过这些安装命令
npm install -g supabase
# 或使用 Scoop（已安装 Scoop 的前提下）：
# scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
# scoop install supabase

supabase --version
```

如果 PowerShell 提示找不到 `supabase`，关闭并重开终端，或检查 npm 全局 bin 是否在 PATH。

### 5.1 登录并关联项目

在项目根目录 `E:\网站` 打开 PowerShell：

```powershell
# 如果还没有 supabase/config.toml，先初始化项目的 Supabase 配置
# （已经初始化过会提示或直接跳过，不要手工覆盖已有配置）
supabase init

supabase login
supabase link --project-ref <你的PROJECT_REF>
```

`login` 会打开浏览器或提示粘贴 access token，按提示完成。
`link` 可能会要求输入数据库密码。

若想显式保留“平台网关先验 JWT”，可以在生成的 `supabase/config.toml` 中加入（没有该段就添加）：

```toml
[functions.ai-assist]
verify_jwt = true
```

这样部署时不加 `--no-verify-jwt`，行为最符合本文推荐。若 CLI 版本或现有配置不同，以 `supabase functions deploy --help` 为准。

> CLI 的大版本可能变化；若提示命令不存在，先 `supabase --help` 查看你安装版本支持的写法。

### 5.2 设置 DeepSeek secret

DeepSeek key 只放在 Supabase 服务端环境变量里。**不要写进 `.env.local`**：

```powershell
supabase secrets set DEEPSEEK_API_KEY=sk-替换成你的真实Key
# 生产建议同时限制允许的浏览器来源，多个来源用英文逗号分隔：
supabase secrets set ALLOWED_ORIGIN=https://你的正式域名
# 本地联调也可先允许：
# supabase secrets set ALLOWED_ORIGIN=http://localhost:5173
```

确认 secret 存在（值不会明文显示）：

```powershell
supabase secrets list
```

`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 由 Supabase 的 Edge Function 运行时自动注入，通常不需要手动设置。不要把这些服务端 secret 复制给前端。

### 5.3 部署

在项目根目录执行：

```powershell
supabase functions deploy ai-assist
```

**要不要加 `--no-verify-jwt`？**

- **推荐不加。** 在你按下一节把 `verify_jwt` 保持为 `true`（或在 CLI 中显式设置）时，Supabase 网关会先校验 JWT，函数内部还会再用 `auth.getUser()` 校验一次，属于双层保护。不同 CLI 版本对默认值的处理可能不同，所以最好写进 `config.toml`，不要依赖默认。
- 需求里提到的写法是：

  ```powershell
  supabase functions deploy ai-assist --no-verify-jwt
  ```

  它会让网关跳过 JWT 校验。**本函数内部仍然要求 Bearer token**，所以即使这样部署也不会变成匿名接口；只是无效请求会先进入函数，浪费一点算力。除非你在排障，或者你有自定义鉴权方案，否则不要加这个 flag。
- 如果部署后调用总是 401，先检查前端有没有发 `Authorization: Bearer <用户JWT>`，不要第一反应去关 JWT 校验。

### 5.4 部署后检查

1. 左侧 **Edge Functions**，确认列表里有 `ai-assist`。
2. **Logs** 可以看调用日志和错误。函数日志里不应出现 API key；代码只记录错误码/阶段。
3. 在 SQL Editor 打开开关（见 3.3）。开关还是 false 时调用会返回 403 `AI_DISABLED`，这是正常保护。
4. 可选的 PowerShell 冒烟测试（把占位符替换掉；access token 从浏览器登录后的 session 里拿，**不要提交到 Git**）：

   ```powershell
   $uri = "https://<PROJECT_REF>.supabase.co/functions/v1/ai-assist"
   $headers = @{
     Authorization = "Bearer <用户ACCESS_TOKEN>"
     apikey        = "<ANON_KEY>"
   }
   $body = @{
     feature = "icebreaker"
     payload = @{ tags = @("羽毛球", "咖啡") }
   } | ConvertTo-Json -Depth 5

   try {
     $resp = Invoke-RestMethod -Method Post -Uri $uri `
       -Headers $headers -ContentType "application/json" -Body $body
     $resp | ConvertTo-Json -Depth 8
   } catch {
     # 429/402/401 等非 2xx 响应，查看状态码与响应正文
     $_.Exception.Response.StatusCode.value__
     $_.ErrorDetails.Message
   }
   ```

   期望成功时是 HTTP 200、`ok: true`；如果 AI 未开启是 403；没有 token 是 401；达到限额是 429；预算用尽/超过上限会返回本地 `fallback`，前端不应该崩。

> 函数里的 `deno` 代码未在本机安装 Deno 检查，也未在真实 Supabase 部署过。第一次调用如果出现 BOOT_ERROR，先看函数 Logs，通常是 esm.sh 导入失败、TypeScript 语法/版本问题或环境变量缺失。

---

## 6. 配置前端 `.env.local`

在项目根目录 `E:\网站` 新建 `.env.local`（Vite 项目会自动读取，且 `.gitignore` 已忽略 `.env` 和 `.env.local`）：

```dotenv
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<你的 anon public key 或 publishable key>
```

注意：

- 变量名必须是 `VITE_` 开头，否则 Vite 不会注入浏览器。
- 结尾不要有多余空格、引号或中文标点。
- 改完 `.env.local` 后重启 `npm run dev`（不是改完立即一定生效）。
- 只放 anon/publishable key。**绝对不要把 `SUPABASE_SERVICE_ROLE_KEY`、数据库密码、DeepSeek key 放进任何 `VITE_*` 变量。**
- `.env.local` 已被 `.gitignore` 忽略；发布到 Cloudflare Pages 时，这两个值要另外配置在 Pages 的环境变量里（见 `docs/DEPLOY.md`）。
- 配置变量不会自动把本地演示数据变成云端数据；前端还需要实际接入 Supabase 客户端并用这些变量初始化。当前后端与文档不修改前端代码。

---

## 7. 关键数据写入规则（避免 RLS 迷惑）

前端所有数据库请求默认以登录用户身份执行，RLS 会检查 `auth.uid()`。最容易踩坑的是“忘了填 `user_id`/`author_id`”：

| 操作 | 必须满足 |
| --- | --- |
| 新建资料 | `profiles.id = 当前登录用户 id`；其实注册触发器会自动建，通常不用手动 insert |
| 写学号摘要 | `profile_private.user_id = 当前用户 id`；哈希必须是 64 位小写十六进制 |
| 加好友申请 | `from_id = 当前用户 id`，且双方没有拉黑 |
| 建圈子 | `created_by = 当前用户 id`，`member_count = 0` |
| 加入圈子 | `user_id = 当前用户 id`；`role='owner'` 只有在创建者本人时才允许 |
| 发搭子帖 | `author_id = 当前用户 id` |
| 加入搭子 | `user_id = 当前用户 id`；帖子必须还是 open 且未满 |
| 建会话 | direct 会话任意登录用户可建；circle 会话要求创建者是该圈成员 |
| 加会话成员 | 自己加入空 direct / 已经是成员 / 圈会话对应圈成员；或把第二人加入自己的 direct |
| 发消息 | 必须是该会话成员，且 `sender_id = 当前用户 id` |
| 好友关系 | 必须先存在双方 `status='accepted'` 的 friend_request，且 `user_a < user_b` |
| 举报/拉黑 | 举报者/拉黑者必须是本人 |

`profile_private` 的学号哈希供 `find_user_by_student_no` 使用。前端如果自行写：

```js
// 仅示意规范化方式：trim 后 SHA-256，小写十六进制
async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input.trim())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

`schema.sql` 的 RPC 也会对输入 `btrim` 后做同样的哈希；前后端规范化必须一致，否则会永远搜不到。
由于学号空间有限，无盐 SHA-256 只能降低直接泄露，不能抵抗数据库泄露后的离线枚举，这一点在 schema 注释里也写明了。

> 会话创建是多步写入，不是数据库事务。若要创建 direct 会话，推荐前端自己生成 UUID：先 insert conversations（带上 id），再 insert 自己的成员行，最后把好友加入。任何一步失败都要按 id 清理已写入的数据。

---

## 8. 常见报错排查表

| 现象/报错 | 常见原因 | 处理 |
| --- | --- | --- |
| `new row violates row-level security policy` | 没有登录、JWT 没带上，或插入行不属于当前用户 | 检查 session；确保 `id/user_id/from_id/author_id` 等等于 `auth.uid()`；在 SQL Editor 查 `select auth.uid();`（浏览器请求里才是当前用户） |
| `permission denied for table ...` | 用错了 key、表被 revoke，或访问了未开放的敏感表 | 前端只能用 anon/publishable；`ai_cache`、`system_settings`、`student_lookup_attempts` 本来就不对 authenticated 开放；写 `ai_usage` 只能服务端 |
| RLS 策略看起来不对，但 SQL Editor 里能查到所有数据 | SQL Editor 用管理员连接，通常会绕过 RLS | 用真实登录用户的 JWT 在浏览器/API 里测；SQL Editor 的查询结果不能代表 RLS 效果 |
| `function public.find_user_by_student_no(...) does not exist` / 404 | schema 没执行成功，或 PostgREST schema cache 未刷新 | 重新执行 schema；执行 `notify pgrst, 'reload schema';`；等待几秒，或在 Dashboard 的 API 设置里 reload schema |
| RPC 提示参数不存在 | 参数名写错（`p_student_no` / `p_circle_id` / `p_since`） | 按 schema 中的参数名传，不要用 `studentNo` 这类前端 camelCase |
| 学号搜索返回空数组 | 对方关闭 `searchable`；没写 `profile_private`；哈希不一致；搜到自己；双方有拉黑；学号被删 | 检查 `profile_private` 和 `profiles.searchable`；确认 trim/SHA-256 规范化一致；搜索 RPC 会排除自己和拉黑关系 |
| 学号搜索抛 `RATE_LIMITED` | 同一账号一小时内超过 30 次 | 等一小时；测试时不要反复狂点。不要为了测试改低限制来上线 |
| 学号搜索抛 `INVALID_STUDENT_NO` | 不是 4～32 位纯数字 | 传纯数字学号并 `trim`；RPC 会拒绝空串 |
| 新用户注册后没有 profiles 行 | 注册触发器没建、注册失败、或旧账号在触发器创建前就存在 | 查 **Authentication → Users** 和 `profiles`；检查 `on_auth_user_created` 触发器；旧账号需补 profiles |
| 邮箱验证链接跳错页面 | Site URL / Redirect URLs 没配 | Authentication → URL Configuration；本项目 HashRouter，跳站点根即可 |
| Edge Function 返回 401 | 没带 `Authorization`、JWT 过期、项目 URL/key 不匹配、网关 verify_jwt 拦截 | 确认请求头 `Authorization: Bearer <access_token>`；重新登录刷新 token；检查函数 URL；不要用 service_role 冒充用户 JWT |
| Edge Function 503 `AI_NOT_CONFIGURED` | DeepSeek secret 没设置、设置到了别的项目、名称不是 `DEEPSEEK_API_KEY` | `supabase secrets list`；重新 `supabase secrets set DEEPSEEK_API_KEY=...`；必要时重新部署 |
| Edge Function 503 `CONFIG_ERROR` | Supabase 自动环境变量没注入（本地 serve 配置缺失） | 线上需正常部署；本地 `supabase functions serve` 会注入；不要手写错误的 URL/key |
| Edge Function 403 `AI_DISABLED` | 数据库开关还是 false | 在 SQL Editor 执行 3.3 的开启语句 |
| Edge Function 429 `COOLDOWN` | 两次调用间隔小于 20 秒 | 等 `retry_after` 秒；这是全局用户级冷却 |
| Edge Function 429 `USER_DAILY_LIMIT` | 个人当天 5 次用完 | 等北京时间次日零点，或在设置里调高 `ai_daily_user_limit` |
| Edge Function 429 `GLOBAL_DAILY_LIMIT` | 全站当天 300 次用完 | 等次日；检查是否有人刷接口；必要时临时关闭 AI |
| Edge Function 402 `DAILY_BUDGET_EXCEEDED` | ai_usage 累计估算成本达到 1.5 元 | 等次日；调高 `ai_daily_budget_cny` 前先核对 DeepSeek 账单；也可以关闭 AI |
| Edge Function 500 `AI_ACCOUNTING_ERROR` | ai_usage 写入失败（表缺失/权限/外键） | 看 Edge Function Logs；确认 schema 完整；确认 profiles 存在；不要靠重试绕过记账 |
| Edge Function 502/504 | DeepSeek 网络/超时/风控/返回异常 | 稍后重试；看函数日志和 DeepSeek 状态；前端展示 fallback；不要无限自动重试 |
| 浏览器报 CORS | `ALLOWED_ORIGIN` 与页面实际 origin 不一致（协议、端口、末尾斜杠） | secret 设为完整 origin，如 `https://xxx.pages.dev`，不要带路径；多个用英文逗号；改后重新部署/再请求 |
| 加入搭子报 `POST_FULL` / `POST_NOT_OPEN` | 帖子已满或已关闭，或已被作者改成 full/closed | 刷新列表；别加入已满帖子；作者可新建或改回 open |
| 好友关系插不进去 | 没有 accepted 的申请，或 `user_a > user_b` | 先让收件人把申请更新为 accepted；插入前按 UUID 字典序排序 |
| `profile_private_student_no_hash_check` 失败 | 哈希不是 64 位小写十六进制 | 用 SHA-256 的十六进制小写；不要存明文/后四位以外的学号 |
| `conversations_kind_circle_match` 失败 | direct 却传了 circle_id，或 circle 没传 circle_id | 按类型填：direct 的 circle_id 为 null；circle 必须指向已有圈子 |
| 新会话查不到 | 还没有插入 conversation_members 行，或不是成员 | 建会话后立即加入自己；select 也只对成员可见。建议客户端自己生成会话 UUID 以便后续步骤定位 |
| SQL 执行到一半失败 | 事务整体回滚 | 看第一条红色错误；修正后整段重跑。`if not exists` 不会修复旧表结构不一致 |
| `create extension pgcrypto` 报权限/已存在 | 当前角色权限不足或扩展已在别处安装 | 在 Supabase 项目应使用 SQL Editor 的 postgres 身份；Database → Extensions 可查看 pgcrypto；don't重复建 |
| Free 项目突然无法访问 | 项目因长期不活跃被暂停 | 到 Supabase Dashboard 恢复项目；生产不要依赖 Free 的保活 |

---

## 9. 上线前安全清单

- [ ] 浏览器 `.env.local` 和生产环境变量里只有 URL + anon/publishable key。
- [ ] GitHub 仓库里没有 `.env`、`.env.local`、DeepSeek key、service_role key。
- [ ] `ai_enabled` 按需要开启，并设置可接受的个人次数、全站次数、预算。
- [ ] `ALLOWED_ORIGIN` 设置为正式域名，不要长期使用 `*`。
- [ ] Supabase Auth 的 Site URL 和 Redirect URLs 已改为正式域名。
- [ ] 已确认 RLS 对陌生用户生效：用另一个账号读不到别人的 `profile_private`、聊天、私密匹配记录。
- [ ] 已了解 `system_settings` / `ai_cache` / `student_lookup_attempts` 不对前端开放。
- [ ] DeepSeek 账号设置了充值上限/告警，不只依赖函数内预算。
- [ ] 定期清理或归档 `student_lookup_attempts`、`ai_usage`、过期 `ai_cache`（当前 schema 没有自动清理任务）。

---

## 10. 常用管理员 SQL

仅在 SQL Editor（管理员身份）使用，不要在浏览器前端调用：

```sql
-- 查看今天（北京时间）的 AI 调用与成本
select
  count(*) as calls,
  coalesce(sum(cost), 0) as cost_cny
from public.ai_usage
where created_at >= (
  date_trunc('day', now() at time zone 'Asia/Shanghai')
  at time zone 'Asia/Shanghai'
);

-- 查看某个用户的 AI 使用
select *
from public.ai_usage
where user_id = '<USER_UUID>'
order by created_at desc
limit 50;

-- 清空 AI 缓存（测试/换模型后可用）
delete from public.ai_cache;

-- 临时关闭 AI
update public.system_settings
set value = 'false'::jsonb, updated_at = now()
where key = 'ai_enabled';
```

> 上述时间 SQL 只是北京时间自然日的常用写法；如果你不熟悉时区，先在测试库验证结果。不要在生产环境随意删 `student_lookup_attempts`，那会削弱防枚举限流。

---

## 11. 相关文件

- `supabase/schema.sql`：建表、RLS、触发器、RPC、种子数据
- `supabase/functions/ai-assist/index.ts`：AI Edge Function
- `docs/DEPLOY.md`：GitHub + Cloudflare Pages 上线流程

如果这份文档和实际控制台对不上，以 Supabase 官方文档和你的项目实际页面为准；不要在不清楚 service_role 权限的情况下把它贴到前端。
