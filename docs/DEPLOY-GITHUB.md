# 三步上线（不需要装 Git）

> 目标：把网站放到公网，聊天记录存在云端，你电脑关机也不影响。

## 第 1 步：把代码放进 GitHub

1. 打开 https://github.com/new
2. Repository name 填 `xiangyu`，选 **Private**（私有），**不要**勾 Add a README
3. 点 **Create repository**
4. 在新页面点 **uploading an existing file**
5. 把 `deploy\xiangyu\` 文件夹里的**所有内容**拖进去（不是拖文件夹本身，是拖里面的文件）
   - 如果浏览器不让拖文件夹：先把 `deploy\xiangyu-src.zip` 解压，再全选拖入
6. 点 **Commit changes**

> 上传前确认：里面有 `src/`、`server/`、`package.json`、`render.yaml`，**没有** `server/data`（聊天记录和照片不能传上去）。

## 第 2 步：在 Render 部署

1. 打开 https://dashboard.render.com/register，用邮箱注册（免费，不用信用卡）
2. 登录后点 **New → Blueprint**
3. 连接 GitHub，选刚才的 `xiangyu` 仓库
4. Render 会自动读到 `render.yaml`，点 **Apply**
5. 等 2–3 分钟，出现 `https://xiangyu-xxxx.onrender.com`

## 第 3 步：验证

打开那个地址，注册一个账号，发一条动态，再用手机（不同网络）打开同一个地址 —— 能看到同一条，就说明数据在云端了。

---

## 两个必须知道的坑

### 1. 免费实例会休眠

15 分钟没人访问，服务会睡过去。**第一次打开要等 30 秒左右**，之后就快了。这是免费版的限制，不是 bug。

### 2. 免费实例没有持久磁盘

Render 的**持久磁盘要付费实例**才支持。免费版的文件系统在**重新部署时会清空** —— 也就是说你现在这套「world.json 存盘」的方案，在免费版上会丢数据。

所以按下面的方式二选一：

| 选择 | 做法 | 代价 |
|---|---|---|
| **A. 先用免费版跑通** | 接受「重新部署会清数据」，只当演示 | 0 元 |
| **B. 加一块磁盘** | 把实例升到 Starter（约 $7/月），挂 1GB 磁盘到 `/var/data`，`XY_DATA_DIR=/var/data` | 每月几十块 |
| **C. 换 Railway** | Railway 有 Volume，免费额度内可用 | 需要绑卡验证 |

如果只是想先让大家看到、数据不重要，选 A。如果要真的长期存聊天记录，选 B 或 C。

---

## 想让我全程代劳？

只需要给我一个 **GitHub Personal Access Token**（不是密码）：

1. 打开 https://github.com/settings/tokens → **Generate new token (classic)**
2. 勾选 **repo** 权限，有效期选 7 天
3. 把 `ghp_` 开头的那串发我

我拿到后可以直接：建仓库 → 用 API 推送全部文件（不需要装 Git）→ 给你 Render 的操作清单。

> 注意：token 等于临时密码，用完可以在同一页面 **Delete** 掉。别把长期有效的 token 发给任何人。
