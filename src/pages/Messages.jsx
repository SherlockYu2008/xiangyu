import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty } from '../components/ui'
import { fmtRelative } from '../lib/time'
import { acceptRequest, declineRequest, personById, useStore } from '../lib/store'

export default function Messages() {
  const s = useStore()
  const convs = [...s.conversations].sort((a, b) => b.lastAt - a.lastAt)
  const pending = s.requests.filter((r) => r.status === 'pending' && r.fromId !== s.me?.id)
  const outgoing = s.requests.filter((r) => r.status === 'pending' && r.fromId === s.me?.id).length

  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">消息</span>
          <h1>聊天和好友申请</h1>
          <p>普通消息走实时通道，每条都在后端做权限校验。</p>
        </div>
      </header>

      {pending.length > 0 && (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>好友申请（{pending.length}）</h3>
              <p>通过后才会出现在聊天列表里</p>
            </div>
          </div>
          <div className="reqlist">
            {pending.map((r) => {
              const p = personById(s, r.fromId)
              return (
                <div className="reqcard" key={r.id}>
                  <Avatar name={p?.nickname} seed={p?.nickname} size={40} online={p?.online} />
                  <div className="reqcard__main">
                    <b>
                      {p?.nickname}
                      <span>
                        {p?.grade} · {p?.major}
                      </span>
                    </b>
                    <p>{r.note || '想认识一下你'}</p>
                  </div>
                  <div className="reqcard__btns">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => declineRequest(r.id)}>
                      忽略
                    </button>
                    <button type="button" className="btn btn--primary btn--sm" onClick={() => acceptRequest(r.id)}>
                      通过
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="convlist">
        {convs.length === 0 ? (
          <Empty
            icon="chat"
            title="还没有聊天"
            desc="去兴趣圈找个搭子，或者从发现页打个招呼。"
            action={
              <Link to="/circles" className="btn btn--primary btn--sm">
                去兴趣圈
              </Link>
            }
          />
        ) : (
          convs.map((c) => {
            const p = personById(s, c.peerId)
            const msgs = s.messages[c.id] || []
            const last = msgs[msgs.length - 1]
            return (
              <Link to={`/messages/${c.id}`} className="conv" key={c.id}>
                <Avatar name={p?.nickname} seed={p?.nickname} size={46} online={p?.online} />
                <div className="conv__main">
                  <div className="conv__top">
                    <b>{p?.nickname}</b>
                    <time>{fmtRelative(c.lastAt)}</time>
                  </div>
                  <p>
                    {last ? `${last.from === s.me?.id ? '你：' : ''}${last.body}` : '开始聊天吧'}
                  </p>
                </div>
                {c.unread > 0 && <i className="conv__dot">{c.unread}</i>}
              </Link>
            )
          })
        )}
      </section>

      <p className="footnote">
        <Icon name="shield" size={14} />
        学号不会出现在任何聊天或公开资料里；被骚扰请拉黑并举报。
      </p>
      {outgoing > 0 && (
        <p className="footnote">
          <Icon name="clock" size={14} />
          你发出的 {outgoing} 个好友申请还在等对方通过，通过后会出现在上面的会话列表里。
        </p>
      )}
    </div>
  )
}
