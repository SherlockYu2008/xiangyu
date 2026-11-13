# 弄一个「永久网址」（不需要买服务器）

> 目标：一个明天、下个月、明年都还能打开的地址。
> 代价：静态托管没有后端，**数据只存在每个访客自己的浏览器里**，大家互相看不见。

---

## 路线 A：GitHub Pages（免费、永久、你现在就有账号）

用时约 10 分钟，不用装软件，不用 token。

### 1. 建仓库

1. 打开 https://github.com/new
2. Repository name 填 `xiangyu`
3. 选 **Public**（公开 —— GitHub Pages 免费版只支持公开仓库）
4. 不要勾 Add a README
5. 点 **Create repository**

### 2. 上传站点文件

1. 解压 `deploy\xiangyu-site.zip`
2. 在新仓库页面点 **uploading an existing file**
3. 把解压出来的 **`index.html` 和 `assets` 文件夹**一起拖进去
4. 点 **Commit changes**

> 注意：`index.html` 必须在仓库根目录，不能套一层文件夹。

### 3. 打开 Pages

1. 仓库 → **Settings** → 左侧 **Pages**
2. Source 选 **Deploy from a branch**
3. Branch 选 **main**，目录选 **/ (root)**
4. 点 **Save**
5. 等 1–2 分钟，页面顶部会出现地址：

```
https://你的用户名.github.io/xiangyu/
```

这个地址**永久有效**，除非你删仓库。

### 4. 验证

- 打开地址，能登录/注册 → 成功
- 手机上打开同一个地址 → 也能用（数据各自独立）
- 刷新任意页面（比如 `#/materials`）不会 404（用的是 hash 路由）

---

## 路线 B：完整版（有后端，能共享数据）

GitHub Pages 只能放静态文件。要让同学之间能互相看见、聊天记录存在云端，必须把 `server/` 也部署出去：

| 平台 | 免费？ | 数据持久 | 需要 |
|---|---|---|---|
| Render | 免费（会休眠） | ❌ 免费版重启丢数据 | 注册 + 连 GitHub |
| Render Starter | $7/月 | ✅ 挂磁盘 | 绑卡 |
| Railway | 有额度 | ✅ Volume | 绑卡 |
| 自己的云服务器 | 几十元/月 | ✅ | 会一点 Linux |

完整步骤见 [DEPLOY-SERVER.md](./DEPLOY-SERVER.md)。

---

## 两条路的取舍

| | 路线 A（Pages） | 路线 B（Render/Railway） |
|---|---|---|
| 地址永久 | ✅ | ✅ |
| 能否互相看见 | ❌ | ✅ |
| 注册登录 | ✅（存本地） | ✅（存云端） |
| 聊天记录 | 只在本机 | 在云端 |
| 适合 | 展示作品、给评委看界面 | 真正给同学用 |

**给比赛用**：先用 A 拿到一个永久地址放进报名材料，再用 B 做"可实际访问与试用"的完整版。两者不冲突。

---

## 以后想绑自己的域名

Pages 支持自定义域名（免费）：Settings → Pages → Custom domain，填你的域名，然后在域名服务商那里加一条 CNAME 记录指向 `你的用户名.github.io`。HTTPS 证书 GitHub 会自动签发。
