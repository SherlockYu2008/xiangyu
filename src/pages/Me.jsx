import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, Modal, Switch, Tag, useToast } from '../components/ui'
import { CAMPUSES, GRADES, TAG_POOL } from '../lib/data'
import { checkPassword, strongPassword } from '../lib/auth'
import { fmtClock, fmtDate } from '../lib/time'
import {
  changePassword,
  clearAll,
  deleteAccount,
  leaveBuddy,
  logout,
  myBuddies,
  setSetting,
  statsOf,
  updateMe,
  useStore,
} from '../lib/store'

const shortDevice = (ua = '') => {
  if (!ua) return '未知设备'
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Mac OS X|Macintosh/i.test(ua)
      ? 'macOS'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad/i.test(ua)
          ? 'iOS'
          : '其他系统'
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua)
      ? 'Chrome'
      : /Safari\//i.test(ua)
        ? 'Safari'
        : /Firefox\//i.test(ua)
          ? 'Firefox'
          : '浏览器'
  return `${os} · ${browser}`
}

export default function Me() {  const s = useStore()
  const nav = useNavigate()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState({ old: '', next: '', next2: '' })
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(null)

  if (!s.me) return null

  const mine = myBuddies(s)
  const stats = statsOf(s, s.me.id)

  const openEdit = () => {
    setForm({
      nickname: s.me.nickname,
      grade: s.me.grade,
      campus: s.me.campus,
      major: s.me.major,
      bio: s.me.bio,
      tags: [...s.me.tags],
    })
    setEditing(true)
  }

  const save = () => {
    if (!form.nickname.trim()) return toast('昵称不能空')
    if (form.tags.length < 3) return toast('兴趣标签至少留 3 个')
    updateMe({ ...form, nickname: form.nickname.trim(), bio: form.bio.trim() })
    setEditing(false)
    toast('资料已更新')
  }

  const toggleTag = (t) =>
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : f.tags.length >= 6 ? f.tags : [...f.tags, t],
    }))

  const submitPw = async () => {
    const rule = strongPassword(pw.next, { nickname: s.me?.nickname || '' })
    if (rule) return toast(rule)
    if (pw.next !== pw.next2) return toast('两次输入的新密码不一致')
    setBusy(true)
    const res = await changePassword(pw.old, pw.next)
    setBusy(false)
    if (!res.ok) return toast(res.error)
    setPwOpen(false)
    setPw({ old: '', next: '', next2: '' })
    toast('密码已更新，下次用新密码登录')
  }

  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">个人中心</span>
          <h1>我的橡遇</h1>
          <p>资料、隐私和账号安全，都在这一页。</p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={openEdit}>
          <Icon name="edit" size={16} /> 编辑资料
        </button>
      </header>

      <section className="meprofile">
        <Avatar name={s.me.nickname} seed={s.me.nickname} size={72} ring online />
        <div className="meprofile__main">
          <h1>
            {s.me.nickname}
            <span className="chip chip--violet">在读</span>
          </h1>
          <p className="meprofile__meta">
            {s.me.grade} · {s.me.major} · {s.me.campus} · 学号 {s.me.studentNo}
          </p>
          <p className="meprofile__bio">{s.me.bio}</p>
          <div className="meprofile__tags">
            {s.me.tags.map((t) => (
              <Tag key={t} tone="plain">
                #{t}
              </Tag>
            ))}
          </div>
        </div>
      </section>

      <div className="mestats">
        <div className="mestat">
          <b>{mine.length}</b>
          <span>加入的搭子</span>
        </div>
        <div className="mestat">
          <b>{s.myCircles.length}</b>
          <span>加入的圈子</span>
        </div>
        <div className="mestat">
          <b>{s.friends.length}</b>
          <span>好友</span>
        </div>
      </div>

      <div className="twocol">
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>我的搭子</h3>
              <p>{mine.length ? '不想去了随时退出，名额会还回去' : '还没加入任何搭子'}</p>
            </div>
          </div>

          {mine.length === 0 ? (
            <Empty
              icon="grid"
              title="还没上车"
              desc="去兴趣圈挑一个，四级、羽毛球、剧本杀都有。"
              action={
                <button type="button" className="btn btn--primary btn--sm" onClick={() => nav('/circles')}>
                  去兴趣圈
                </button>
              }
            />
          ) : (
            <div>
              {mine.map((b) => (
                <div className="mini" key={b.id}>
                  <Avatar name={s.me.nickname} seed={s.me.nickname} size={32} />
                  <div>
                    <b>{b.title}</b>
                    <span>
                      {b.time} · {b.place}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      leaveBuddy(b.id)
                      toast('已退出这个搭子')
                    }}
                  >
                    退出
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', margin: '6px 0 12px' }} />
            <b style={{ fontSize: 13 }}>我加入的圈子</b>
            <div className="tagpool" style={{ marginTop: 8 }}>
              {s.myCircles.length === 0 && <span className="panel__text">还没有加入圈子。</span>}
              {s.myCircles.map((slug) => {
                const c = s.circles.find((x) => x.slug === slug)
                return (
                  <Tag key={slug} tone="brand" onClick={() => nav(`/circles/${slug}`)}>
                    {c?.emoji} {c?.name}
                  </Tag>
                )
              })}
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>隐私与安全</h3>
              <p>学号进数据库就存哈希，任何时候都不公开</p>
            </div>
          </div>

          <div>
            <div className="settingrow">
              <div>
                <b>允许同学搜到我</b>
                <span>关掉后，别人用学号搜不到你</span>
              </div>
              <Switch
                checked={s.settings.searchable}
                label="允许被搜索"
                onChange={(v) => setSetting('searchable', v)}
              />
            </div>
            <div className="settingrow">
              <div>
                <b>允许随机匹配</b>
                <span>关掉后不会出现在随机池里</span>
              </div>
              <Switch
                checked={s.settings.allowRandom}
                label="允许随机匹配"
                onChange={(v) => setSetting('allowRandom', v)}
              />
            </div>
            <div className="settingrow">
              <div>
                <b>学号</b>
                <span>仅你可见，已打码存储</span>
              </div>
              <span className="pill">{s.me.studentNo}</span>
            </div>
            <div className="settingrow">
              <div>
                <b>拉黑与举报</b>
                <span>在聊天页右上角操作，记录只给管理员看</span>
              </div>
              <Icon name="shield" size={18} />
            </div>
          </div>

          <p className="panel__note">
            <Icon name="shield" size={14} />
            账号只存这台设备；以上开关只影响本机数据，正式版由 Supabase RLS 强制执行。
          </p>
        </section>
      </div>

      <div className="twocol">
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>我的内容</h3>
              <p>发过多少、传过多少，一目了然</p>
            </div>
          </div>

          <div className="settingrow">
            <div>
              <b>动态</b>
              <span>新鲜事里发过的条数</span>
            </div>
            <Link to="/" className="pill">
              {stats.posts} 条
            </Link>
          </div>
          <div className="settingrow">
            <div>
              <b>相册 / 照片</b>
              <span>我建的相册和上传的照片</span>
            </div>
            <Link to="/albums" className="pill">
              {stats.albums} / {stats.photos}
            </Link>
          </div>
          <div className="settingrow">
            <div>
              <b>日志</b>
              <span>写过的长文</span>
            </div>
            <Link to="/diary" className="pill">
              {stats.diaries} 篇
            </Link>
          </div>
          <div className="settingrow">
            <div>
              <b>资料</b>
              <span>在资料库分享的份数</span>
            </div>
            <Link to="/materials" className="pill">
              {s.materials.filter((m) => m.ownerId === s.me.id).length} 份
            </Link>
          </div>
          <p className="panel__note">
            <Icon name="shield" size={14} />
            资料和照片都可以随时删除，删掉后别人也看不到了。
          </p>
        </section>

        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>账号</h3>
              <p>注册于 {fmtDate(s.me.createdAt || Date.now())}</p>
            </div>
          </div>

          <div className="settingrow">
            <div>
              <b>最近登录</b>
              <span>
                {s.me.security?.lastLoginAt
                  ? `${fmtDate(s.me.security.lastLoginAt)} ${fmtClock(s.me.security.lastLoginAt)} · ${shortDevice(s.me.security.lastLoginDevice)}`
                  : '这是第一次登录'}
              </span>
            </div>
            <span className="pill">
              {s.sessionExpiresAt ? `有效期至 ${fmtDate(s.sessionExpiresAt)}` : '本次会话'}
            </span>
          </div>

          <div className="settingrow">
            <div>
              <b>连续输错会锁定</b>
              <span>同一账号密码错 5 次，锁 5 分钟，锁定期内正确密码也进不去</span>
            </div>
            <Icon name="shield" size={17} />
          </div>

          <div className="settingrow">
            <div>
              <b>修改密码</b>
              <span>改完下次要用新密码登录</span>
            </div>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setPwOpen(true)}>
              修改
            </button>
          </div>

          <div className="settingrow">
            <div>
              <b>退出登录</b>
              <span>本机数据保留，下次还能回到这个身份</span>
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                logout()
                nav('/welcome')
              }}
            >
              <Icon name="logout" size={15} /> 退出
            </button>
          </div>

          <div className="settingrow">
            <div>
              <b className="dangerbtn">删除账号</b>
              <span>连同你发的搭子、聊天记录一起删掉</span>
            </div>
            <button type="button" className="btn btn--ghost btn--sm dangerbtn" onClick={() => setConfirmDelete(true)}>
              删除
            </button>
          </div>

          <p className="panel__note">
            <Icon name="shield" size={14} />
            账号只存在这台设备，没有服务器端找回。忘了密码就只能重新注册，或者清空本机数据。
            <button type="button" className="linkbtn" onClick={() => setConfirmClear(true)}>
              清空本机全部账号
            </button>
          </p>
        </section>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="编辑资料"
        subtitle="改完立刻生效，匹配分数也会跟着变"
        footer={
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setEditing(false)}>
              取消
            </button>
            <button type="button" className="btn btn--primary" onClick={save}>
              保存
            </button>
          </div>
        }
      >
        {form && (
          <div className="form">
            <label className="field">
              <span>昵称</span>
              <input
                value={form.nickname}
                maxLength={20}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>年级</span>
                <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                  {GRADES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>校区</span>
                <select value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value })}>
                  {CAMPUSES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>专业</span>
              <input value={form.major} maxLength={24} onChange={(e) => setForm({ ...form, major: e.target.value })} />
            </label>
            <label className="field">
              <span>一句话介绍</span>
              <textarea rows={3} maxLength={120} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </label>
            <div className="field">
              <span>
                兴趣标签 <i>3–6 个</i>
              </span>
              <div className="tagpool">
                {TAG_POOL.map((t) => (
                  <Tag key={t} tone={form.tags.includes(t) ? 'brand' : 'plain'} active={form.tags.includes(t)} onClick={() => toggleTag(t)}>
                    {t}
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="修改密码"
        width={420}
        footer={
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setPwOpen(false)}>
              取消
            </button>
            <button type="button" className="btn btn--primary" onClick={submitPw} disabled={busy}>
              {busy ? '处理中…' : '保存'}
            </button>
          </div>
        }
      >
        <div className="form">
          <label className="field">
            <span>原密码</span>
            <input
              type="password"
              value={pw.old}
              onChange={(e) => setPw({ ...pw, old: e.target.value })}
              placeholder="当前密码"
            />
          </label>
          <label className="field">
            <span>新密码</span>
            <input
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              placeholder="至少 6 位"
            />
          </label>
          <label className="field">
            <span>再输一次新密码</span>
            <input
              type="password"
              value={pw.next2}
              onChange={(e) => setPw({ ...pw, next2: e.target.value })}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="确定删除账号？"
        width={440}
        footer={
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmDelete(false)}>
              算了
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                deleteAccount()
                setConfirmDelete(false)
                nav('/welcome')
              }}
            >
              确认删除
            </button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.8 }}>
          会删掉你的资料、你发的搭子、你的聊天记录和圈子记录。这个操作没法撤销，也没有备份。
        </p>
      </Modal>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="清空这台设备上的全部账号？"
        width={440}
        footer={
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setConfirmClear(false)}>
              算了
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                clearAll()
                setConfirmClear(false)
                nav('/welcome')
              }}
            >
              确认清空
            </button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.8 }}>
          会把浏览器里存的账号、搭子、聊天全部删掉，回到“一台空设备”。换设备或清浏览器缓存也会达到同样效果。
        </p>
      </Modal>
    </div>
  )
}
