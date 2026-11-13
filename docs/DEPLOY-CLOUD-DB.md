# 让所有人互通：后端上云 + 云数据库

> 为什么一定要做这一步：GitHub Pages 只能放静态文件，没有后端。
> 每台电脑各存各的数据，所以「别人注册的账号你看不到」，而且「每个人在自己设备上都是管理员」。
> 唯一的修法：把 `server/` 跑起来，数据放云端。

---

## 现在的架构（改完之后）

```
浏览器 ──HTTPS──▶ Render 上的 Node 服务 ──REST──▶ Supabase（Postgres，存一份 JSON）
                        │
                        └── /uploads/xxx.jpg 也从这个 JSON 里读（服务端无状态）
```

- 服务端**不写本地磁盘**，重启/重新部署都不丢数据
- 所有浏览器连的是**同一个服务**，看到的是同一份数据
- 只有你（数据库里 `role=admin` 的那个账号）能看到「管理」

---

## 需要两个免费账号（各 1 分钟，都能用 GitHub 登录）

| 平台 | 作用 | 免费额度 |
|---|---|---|
| Supabase | 云数据库 | 500MB 存储，够几百人用 |
| Render | 跑 Node 服务 | 免费实例（15 分钟无访问会休眠） |

---

## 第 1 步：建数据库（Supabase）

1. <https://supabase.com> → Start your project → **用 GitHub 登录**
2. New project：名字随意，Region 选 **Northeast Asia (Tokyo)** 或 Singapore，密码随便设（不用记）
3. 等 1–2 分钟初始化完
4. 左侧 **SQL Editor** → New query → 粘贴执行：

```sql
create table if not exists world (
  id int primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
alter table world enable row level security;
```

> 开了 RLS 但没建策略，意味着**只有 service_role 能读写**，前端拿 anon key 也读不到，安全。

5. 左侧 **Project Settings → API**，记下两个值：
   - **Project URL**（形如 `https://xxxx.supabase.co`）
   - **service_role key**（`eyJ...` 很长那串，标着 `service_role`，**不要泄露**）

---

## 第 2 步：部署服务（Render）

1. <https://dashboard.render.com> → **用 GitHub 登录**
2. **New → Blueprint** → 选 `SherlockYu2008/xiangyu` 仓库 → Apply
3. 在环境变量里填两个：

   | Key | Value |
   |---|---|
   | `XY_DB_URL` | 第 1 步的 Project URL |
   | `XY_DB_KEY` | 第 1 步的 service_role key |

4. 保存，等 2–3 分钟，拿到 `https://xiangyu-xxxx.onrender.com`

---

## 第 3 步：验证真的互通

1. 电脑 A 打开 Render 给的地址，注册「甲」
2. 手机（切到 4G，别用同一个 WiFi 也行）打开同一地址，注册「乙」
3. 电脑 A 刷新 → 「可能认识的人」里应该出现「乙」
4. 手机发一条动态 → 电脑刷新能看到
5. 用 `node server/admin.mjs 甲` 把甲设为管理员（**在 Render 上**：Shell 里执行），只有甲能看到「管理」

> Render 免费实例休眠后第一次打开要等 30 秒，这是正常的。

---

## 常见问题

**Q：一定要两块服务吗？能不能只用一个？**
A：能。如果愿意花钱，Render 付费实例 + 1GB 磁盘（$7/月）就不用 Supabase；反过来，数据放 Supabase 的话，任何能跑 Node 的免费平台都行。

**Q：照片存在哪？**
A：云数据库模式下，照片以 base64 存进同一份 JSON 的 `__files` 里，通过 `/uploads/xxx.jpg` 返回。500MB 够存几千张压过的图。

**Q：域名能绑吗？**
A：Render 免费版可以绑自定义域名（Settings → Custom Domain）。

**Q：之前 GitHub Pages 那个地址还要吗？**
A：留着当「产品介绍页」可以，但它永远只能看不能互通。正式入口用 Render 的地址。
