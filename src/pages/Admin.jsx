import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, Tag, useToast } from '../components/ui'
import { fmtDate, fmtRelative } from '../lib/time'
import {
  adminAnnounce,
  adminBanUser,
  adminDeleteAlbum,
  adminDeleteDiary,
  adminDeletePost,
  adminPinPost,
  adminSetRole,
  adminUnbanUser,
  isAdmin,
  personById,
  useStore,
} from '../lib/store'

export default function Admin() {
  const s = useStore()
  const toast = useToast()
  const [tab, setTab] = useState('dash')
  const [draft, setDraft] = useState(s.announcement?.text || '')

  const stats = useMemo(
    () => ({
      users: s.users.length,
      banned: s.users.filter((u) => u.banned).length,
      admins: s.users.filter((u) => u.role === 'admin').length,
      posts: s.posts.length,
      albums: s.albums.length,
      photos: s.albums.reduce((n, a) => n + a.photos.length, 0),
      diaries: s.diaries.length,
      messages: Object.values(s.messages).reduce((n, list) => n + list.length, 0),
      myImages: s.albums.reduce((n, a) => n + a.photos.length, 0),
    }),
    [s],
  )

  if (!isAdmin(s)) {
    return (
      <div className="page">
        <Empty
          icon="shield"
          title="没有管理权限"
          desc="这个页面只有管理员能进。如果你的账号还没升级，让管理员在服务器上运行：node server/admin.mjs 你的昵称"
          action={
            <Link to="/" className="btn btn--primary btn--sm">
              回首页
            </Link>
          }
        />
      </div>
    )
  }

  const sortedPosts = [...s.posts].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt)

  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">管理员</span>
          <h1>管理后台</h1>
          <p>这些操作在服务端校验权限，前端只是入口。做得过分的事会记在日志里。</p>
        </div>
        <span className="chip chip--violet">
          <Icon name="shield" size={13} /> 管理员
        </span>
      </header>

      <div className="tabs tabs--line">
        {[
          { k: 'dash', label: '概览' },
          { k: 'users', label: `成员 ${stats.users}` },
          { k: 'content', label: `内容 ${stats.posts + stats.albums + stats.diaries}` },
          { k: 'announce', label: '公告' },
        ].map((t) => (
          <button key={t.k} type="button" className={`tabline ${tab === t.k ? 'is-on' : ''}`} onClick={() => setTab(t.k)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dash' && (
        <>
          <div className="mestats admingrid">
            {[
              ['注册用户', stats.users],
              ['管理员', stats.admins],
              ['被封禁', stats.banned],
              ['动态', stats.posts],
              ['相册', stats.albums],
              ['照片', stats.photos],
              ['日志', stats.diaries],
              ['私信', stats.messages],
            ].map(([label, value]) => (
              <div className="mestat" key={label}>
                <b>{value}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <section className="panel">
            <div className="panel__head">
              <div>
                <h3>最近动态</h3>
                <p>可以直接删除或置顶</p>
              </div>
            </div>
            {sortedPosts.length === 0 ? (
              <p className="panel__text">还没有人发动态。</p>
            ) : (
              <div className="adminlist">
                {sortedPosts.slice(0, 8).map((p) => {
                  const author = personById(s, p.authorId)
                  return (
                    <div className="adminrow" key={p.id}>
                      <Avatar name={author?.nickname} seed={author?.nickname} size={30} />
                      <div className="adminrow__main">
                        <b>
                          {author?.nickname}
                          {p.pinned && <i className="adminrow__pin">置顶</i>}
                        </b>
                        <span>{p.text.slice(0, 60) || '（图片动态）'}</span>
                      </div>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => adminPinPost(p.id, !p.pinned)}>
                        {p.pinned ? '取消置顶' : '置顶'}
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm dangerbtn"
                        onClick={() => {
                          adminDeletePost(p.id)
                          toast('已删除')
                        }}
                      >
                        删除
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'users' && (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>成员（{stats.users}）</h3>
              <p>封禁后无法登录；管理员不会被封禁</p>
            </div>
          </div>
          <div className="adminlist">
            {s.users.map((u) => (
              <div className="adminrow" key={u.id}>
                <Avatar name={u.nickname} seed={u.nickname} size={32} />
                <div className="adminrow__main">
                  <b>
                    {u.nickname}
                    {u.role === 'admin' && <i className="adminrow__pin">管理员</i>}
                    {u.banned && <i className="adminrow__ban">已封禁</i>}
                    {u.id === s.me?.id && <i className="adminrow__me">是你</i>}
                  </b>
                  <span>
                    {u.grade} · {u.major} · 加入于 {fmtDate(u.createdAt)}
                  </span>
                </div>
                {u.id !== s.me?.id && (
                  <>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        adminSetRole(u.id, u.role === 'admin' ? 'user' : 'admin')
                        toast(u.role === 'admin' ? '已取消管理员' : '已设为管理员')
                      }}
                    >
                      {u.role === 'admin' ? '取消管理员' : '设为管理员'}
                    </button>
                    <button
                      type="button"
                      className={`btn btn--ghost btn--sm ${u.banned ? '' : 'dangerbtn'}`}
                      disabled={u.role === 'admin'}
                      onClick={() => {
                        if (u.banned) {
                          adminUnbanUser(u.id)
                          toast('已解封')
                        } else {
                          adminBanUser(u.id)
                          toast('已封禁')
                        }
                      }}
                    >
                      {u.banned ? '解封' : '封禁'}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'content' && (
        <div className="twocol">
          <section className="panel">
            <div className="panel__head">
              <div>
                <h3>相册（{stats.albums}）</h3>
                <p>删掉会连同照片一起消失</p>
              </div>
            </div>
            {s.albums.length === 0 ? (
              <p className="panel__text">没有相册。</p>
            ) : (
              <div className="adminlist">
                {s.albums.map((a) => {
                  const owner = personById(s, a.ownerId)
                  return (
                    <div className="adminrow" key={a.id}>
                      <span className="adminrow__ico">🖼</span>
                      <div className="adminrow__main">
                        <b>{a.name}</b>
                        <span>
                          {owner?.nickname} · {a.photos.length} 张 · {fmtRelative(a.createdAt)}
                        </span>
                      </div>
                      <Link to={`/albums/${a.id}`} className="btn btn--ghost btn--sm">
                        查看
                      </Link>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm dangerbtn"
                        onClick={() => {
                          adminDeleteAlbum(a.id)
                          toast('相册已删除')
                        }}
                      >
                        删除
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel__head">
              <div>
                <h3>日志（{stats.diaries}）</h3>
              </div>
            </div>
            {s.diaries.length === 0 ? (
              <p className="panel__text">没有日志。</p>
            ) : (
              <div className="adminlist">
                {s.diaries.map((d) => {
                  const author = personById(s, d.authorId)
                  return (
                    <div className="adminrow" key={d.id}>
                      <span className="adminrow__ico">📓</span>
                      <div className="adminrow__main">
                        <b>{d.title}</b>
                        <span>
                          {author?.nickname} · {fmtDate(d.createdAt)}
                        </span>
                      </div>
                      <Link to={`/diary/${d.id}`} className="btn btn--ghost btn--sm">
                        查看
                      </Link>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm dangerbtn"
                        onClick={() => {
                          adminDeleteDiary(d.id)
                          toast('日志已删除')
                        }}
                      >
                        删除
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'announce' && (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>全站公告</h3>
              <p>会显示在所有人的首页顶部，留空就是取消</p>
            </div>
          </div>
          {s.announcement && (
            <div className="announce">
              <b>当前公告</b>
              <p>{s.announcement.text}</p>
              <span>
                {s.announcement.by} · {fmtRelative(s.announcement.at)}
              </span>
            </div>
          )}
          <label className="field">
            <span>公告内容（最多 120 字）</span>
            <textarea
              rows={3}
              maxLength={120}
              value={draft}
              placeholder="比如：本周六下午三点，崂山校区操场，羽毛球局，缺 4 人。"
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                adminAnnounce(draft)
                toast(draft.trim() ? '公告已更新' : '公告已取消')
              }}
            >
              发布公告
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setDraft('')
                adminAnnounce('')
                toast('公告已取消')
              }}
            >
              取消公告
            </button>
          </div>
          <p className="panel__note">
            <Icon name="shield" size={14} />
            公告只有管理员能改，服务端会校验 role，普通用户直接调接口也会被拒绝。
          </p>
        </section>
      )}
    </div>
  )
}
