# 把后端搬到云端：聊天记录就不在你电脑里了

## 先说清楚现在的数据流

```
浏览器  ──HTTP──▶  server/index.mjs  ──读写──▶  server/data/world.json
（前端）           （跑在你电脑上的 Node）        （消息、账号、动态都在这）
                                            └──▶  server/data/uploads/（照片）
```

所以「消息存在服务器上」这句话现在也成立，只不过**那台服务器 = 你的电脑**。
要变成云端，只需要把 `server/` 这个 Node 服务搬到一台 24 小时在线的机器上，代码一行都不用改。

数据目录已经支持用环境变量指定：

```bash
XY_DATA_DIR=/var/data node server/index.mjs
```

---

## 方案 A：Render（免费，推荐先试）

1. 把项目推到 GitHub（`.gitignore` 已经排除 `node_modules`、`dist`、`server/data`）
2. Render 控制台 → **New → Web Service** → 选这个仓库
3. 填：

   | 项 | 值 |
   |---|---|
   | Runtime | Node |
   | Build Command | `npm install && npm run build` |
   | Start Command | `node server/index.mjs` |

4. **Environment** 加两个：
   - `XY_SECRET` = 一串 40 位以上的随机字符
   - `XY_DATA_DIR` = `/var/data`
5. **Disks** → Add Disk：Name `data`，Mount Path `/var/data`，Size 1GB
6. Deploy，等两分钟，拿到 `https://xxx.onrender.com`

> 仓库里已经放了 `render.yaml`，也可以在 Render 里选 **Blueprint** 直接导入。

**注意**：免费实例 15 分钟没人访问会休眠，第一次打开要等 30 秒左右。磁盘是持久的，数据不会丢。

---

## 方案 B：Railway

同样连仓库，加一个 **Volume** 挂到 `/data`，环境变量同上（`XY_DATA_DIR=/data`）。
优势是不休眠（有免费额度），缺点是要绑卡。

---

## 方案 C：自己的云服务器（最稳）

```bash
# 本地打包上传
scp -r server dist package.json package-lock.json root@你的IP:/opt/xiangyu/

# 服务器上
cd /opt/xiangyu
npm ci --omit=dev
XY_SECRET=你的长随机串 XY_DATA_DIR=/opt/xiangyu/data pm2 start server/index.mjs --name xiangyu
pm2 save && pm2 startup
```

再用 nginx 反代 80/443，`certbot --nginx` 一键 HTTPS。
1 核 2G 的机器足够几百人用。

---

## 方案 D：消息改存托管数据库（Supabase）

如果以后人多了、想要实时推送和自动备份，就把 `world.json` 换成 Postgres：

- 表结构在 `supabase/schema.sql`（`conversations` / `messages` / `conversation_members` 已经写好了）
- 改动点：`server/index.mjs` 里的 `chat.*` 操作改成 SQL 语句
- 或者干脆让前端直连 Supabase Realtime，后端只负责鉴权

好处：不用自己管磁盘、天生多副本、能做实时推送。
代价：要改代码，且需要注册 Supabase（免费）。

---

## 迁移现有数据（别忘了这一步）

聊天记录和照片现在都在你硬盘上，搬过去：

```bash
cd E:\网站
node scripts/backup-data.mjs      # 生成 backups/data-2026-11-06-19-xx/
```

然后把备份里的 **`world.json` 和 `uploads/` 整个目录**上传到云端的 `XY_DATA_DIR` 下，重启服务即可。

---

## 上线前检查

- [ ] `XY_SECRET` 换成随机长串（默认值等于谁都能伪造登录）
- [ ] 全站 HTTPS（Render/Railway 自带）
- [ ] 定期备份：`node scripts/backup-data.mjs`，或直接备份那台机器的数据目录
- [ ] `.gitignore` 里有 `server/data`，别把聊天记录提交到 GitHub
- [ ] 加验证码或邀请码再开放注册
