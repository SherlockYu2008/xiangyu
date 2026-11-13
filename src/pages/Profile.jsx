import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, Tag, useToast } from '../components/ui'
import { PostCard } from '../components/social'
import { fmtDate, fmtRelative } from '../lib/time'
import {
  acceptRequest,
  albumsOf,
  diariesOf,
  friendSuggestions,
  guestbookOf,
  personById,
  postsOf,
  recordVisit,
  sendRequest,
  startChat,
  statsOf,
  useStore,
  writeGuestbook,
} from '../lib/store'

const TABS = [
  { key: 'posts', label: '动态' },
  { key: 'albums', label: '相册' },
  { key: 'diary', label: '日志' },
  { key: 'board', label: '留言板' },
]

export default function Profile() {
  const { id } = useParams()
  const s = useStore()
  const toast = useToast()
  const [tab, setTab] = useState('posts')
  const [note, setNote] = useState('')

  const uid = id === 'me' ? s.me?.id : id
  const isMe = uid === s.me?.id
  const person = isMe ? s.me : personById(s, uid)
  const friend = s.friends.includes(uid)

  useEffect(() => {
    if (uid && !isMe) recordVisit(uid)
  }, [uid, isMe])

  /* 下面这些必须在 hooks 之后算，避免条件 return 打乱顺序 */
  const posts = useMemo(() => postsOf(s, uid), [s, uid])
  const albums = useMemo(() => albumsOf(s, uid), [s, uid])
  const diaries = useMemo(() => diariesOf(s, uid), [s, uid])
  const board = useMemo(() => guestbookOf(s, uid), [s, uid])
  const stats = statsOf(s, uid)

  if (!s.me) return null
  if (!person) {
    return (
      <div className="page">
        <Empty icon="user" title="找不到这个人" desc="TA 可能已经注销了账号。" action={<Link to="/friends" className="btn btn--primary btn--sm">去朋友页</Link>} />
      </div>
    )
  }

  const requestSent = s.requests.some((r) => r.fromId === s.me.id && r.toId === uid && r.status === 'pending')
  const incoming = s.requests.find((r) => r.fromId === uid && r.toId === s.me.id && r.status === 'pending')
  const suggest = friendSuggestions(s, 3).find((x) => x.person.id === uid)

  const chat = () => {
    const cid = startChat(uid)
    if (cid) window.location.hash = `#/messages/${cid}`
  }

  const submitNote = () => {
    if (!note.trim()) return
    if (writeGuestbook(uid, note)) {
      setNote('')
      toast('留言成功')
    }
  }

  return (
    <div className="page">
      <header className="profile">
        <div className="profile__cover" />
        <div className="profile__body">
          <Avatar name={person.nickname} seed={person.nickname} size={92} ring online={person.online} className="profile__avatar" />
          <div className="profile__main">
            <h1>
              {person.nickname}
              {isMe && <span className="chip chip--violet">这是你</span>}
              {friend && <span className="chip chip--mint">好友</span>}
            </h1>
            <p className="profile__meta">
              {person.grade} · {person.major} · {person.campus}
            </p>
            <p className="profile__bio">{person.bio}</p>
            <div className="profile__tags">
              {person.tags.map((t) => (
                <Tag key={t} tone="plain">
                  #{t}
                </Tag>
              ))}
            </div>
          </div>
          <div className="profile__acts">
            {isMe ? (
              <Link to="/me" className="btn btn--ghost btn--sm">
                <Icon name="edit" size={15} /> 编辑资料
              </Link>
            ) : (
              <>
                <button type="button" className="btn btn--primary btn--sm" onClick={chat}>
                  <Icon name="chat" size={15} /> 发私信
                </button>
                {friend ? (
                  <span className="btn btn--ghost btn--sm" style={{ cursor: 'default' }}>
                    <Icon name="check" size={15} /> 已是好友
                  </span>
                ) : incoming ? (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => {
                      acceptRequest(incoming.id)
                      toast('已通过好友申请')
                    }}
                  >
                    通过申请
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--soft btn--sm"
                    disabled={requestSent}
                    onClick={() => {
                      sendRequest(uid, '在校内页看到你，加个好友')
                      toast('好友申请已发出')
                    }}
                  >
                    <Icon name="plus" size={15} /> {requestSent ? '申请中' : '加好友'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="profile__stats">
          <span>
            <b>{stats.friends}</b>好友
          </span>
          <span>
            <b>{stats.posts}</b>动态
          </span>
          <span>
            <b>{stats.photos}</b>照片
          </span>
          <span>
            <b>{stats.diaries}</b>日志
          </span>
          <span>
            <b>{stats.visits}</b>访客
          </span>
        </div>
      </header>

      {!isMe && !friend && suggest && (
        <p className="hintbar">
          <Icon name="sparkles" size={15} />
          你们有 {suggest.shared.length} 个共同兴趣{suggest.mutual ? `、${suggest.mutual} 个共同好友` : ''}，加个好友吧。
        </p>
      )}

      <div className="tabs tabs--line">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`tabline ${tab === t.key ? 'is-on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'posts' && (
        <div className="feedlist">
          {posts.length === 0 ? (
            <Empty icon="edit" title="还没有动态" desc={isMe ? '回首页发一条吧。' : 'TA 还没发过动态。'} />
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      )}

      {tab === 'albums' && (
        <div className="albumgrid">
          {albums.length === 0 ? (
            <Empty icon="image" title="还没有相册" desc={isMe ? '去相册页建一个。' : 'TA 还没传照片。'} action={isMe ? <Link to="/albums" className="btn btn--primary btn--sm">去相册</Link> : null} />
          ) : (
            albums.map((a) => (
              <Link to={`/albums/${a.id}`} className="albumcard" key={a.id}>
                <div className="albumcard__cover">
                  {a.photos[0] ? <img src={a.photos[0].dataUrl} alt="" /> : <span>📷</span>}
                </div>
                <div className="albumcard__meta">
                  <b>{a.name}</b>
                  <span>{a.photos.length} 张 · {fmtDate(a.createdAt)}</span>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'diary' && (
        <div className="diarylist">
          {diaries.length === 0 ? (
            <Empty icon="book" title="还没有日志" desc={isMe ? '写一篇，记录一下这周。' : 'TA 还没写过日志。'} />
          ) : (
            diaries.map((d) => (
              <Link to={`/diary/${d.id}`} className="diaryrow" key={d.id}>
                <h3>{d.title}</h3>
                <p>{d.body.slice(0, 120)}</p>
                <span>
                  {fmtDate(d.createdAt)} · {d.likes.length} 赞 · {d.comments.length} 评论
                </span>
              </Link>
            ))
          )}
        </div>
      )}

      {tab === 'board' && (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>留言板（{board.length}）</h3>
              <p>校内网的老规矩：来都来了，踩一脚再走。</p>
            </div>
          </div>

          {!isMe && (
            <div className="comment__input">
              <input
                value={note}
                maxLength={300}
                placeholder={`给 ${person.nickname} 留句话…`}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitNote()}
              />
              <button type="button" className="btn btn--primary btn--sm" onClick={submitNote} disabled={!note.trim()}>
                留言
              </button>
            </div>
          )}

          {board.length === 0 ? (
            <p className="panel__text">还没有人留言。</p>
          ) : (
            <div className="board">
              {board.map((g) => {
                const from = personById(s, g.fromId)
                return (
                  <div className="boardrow" key={g.id}>
                    <Link to={`/u/${g.fromId}`}>
                      <Avatar name={from?.nickname} seed={from?.nickname} size={34} />
                    </Link>
                    <div>
                      <p>
                        <Link to={`/u/${g.fromId}`}>{from?.nickname}</Link>：{g.text}
                      </p>
                      <time>{fmtRelative(g.at)}</time>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
