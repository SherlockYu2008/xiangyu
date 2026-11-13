import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, useToast } from '../components/ui'
import { fmtRelative } from '../lib/time'
import {
  acceptRequest,
  declineRequest,
  friendSuggestions,
  personById,
  removeFriend,
  sendRequest,
  startChat,
  useStore,
} from '../lib/store'

const TABS = [
  { key: 'friends', label: '我的好友' },
  { key: 'requests', label: '好友申请' },
  { key: 'find', label: '找同学' },
]

export default function Friends() {
  const s = useStore()
  const toast = useToast()
  const [tab, setTab] = useState('friends')
  const [q, setQ] = useState('')

  const pending = s.requests.filter((r) => r.status === 'pending' && r.fromId !== s.me?.id)
  const outgoing = s.requests.filter((r) => r.status === 'pending' && r.fromId === s.me?.id)
  const suggestions = useMemo(() => friendSuggestions(s, 20), [s])

  const friends = s.friends.map((id) => personById(s, id)).filter(Boolean)

  const list = useMemo(() => {
    const kw = q.trim()
    if (!kw) return suggestions
    return suggestions.filter(
      (x) => x.person.nickname.includes(kw) || x.person.major.includes(kw) || x.person.tags.some((t) => t.includes(kw)),
    )
  }, [suggestions, q])

  const chat = (id) => {
    const cid = startChat(id)
    if (cid) window.location.hash = `#/messages/${cid}`
  }

  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">朋友</span>
          <h1>你的同学录</h1>
          <p>校内网的老玩法：先加好友，才能看见彼此的动态、相册和留言板。</p>
        </div>
      </header>

      <div className="tabs tabs--line">
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`tabline ${tab === t.key ? 'is-on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.key === 'requests' && pending.length > 0 && <i className="tabline__dot">{pending.length}</i>}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <>
          {friends.length === 0 ? (
            <Empty
              icon="friends"
              title="还没有好友"
              desc="去「找同学」加几个，或者把网址发给同学，等他们注册。"
              action={
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setTab('find')}>
                  去找同学
                </button>
              }
            />
          ) : (
            <div className="grid grid--2">
              {friends.map((p) => (
                <article className="friendcard" key={p.id}>
                  <Link to={`/u/${p.id}`}>
                    <Avatar name={p.nickname} seed={p.nickname} size={44} online={p.online} />
                  </Link>
                  <div className="friendcard__main">
                    <Link to={`/u/${p.id}`}>
                      <b>{p.nickname}</b>
                    </Link>
                    <span>
                      {p.grade} · {p.major} · {p.campus}
                    </span>
                  </div>
                  <div className="friendcard__btns">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => chat(p.id)}>
                      私信
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => {
                        removeFriend(p.id)
                        toast('已删除好友')
                      }}
                    >
                      删除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'requests' && (
        <div className="twocol">
          <section className="panel">
            <div className="panel__head">
              <div>
                <h3>收到的申请（{pending.length}）</h3>
                <p>通过后才会变成好友</p>
              </div>
            </div>
            {pending.length === 0 ? (
              <p className="panel__text">没有新的申请。</p>
            ) : (
              <div className="reqlist">
                {pending.map((r) => {
                  const p = personById(s, r.fromId)
                  return (
                    <div className="reqcard" key={r.id}>
                      <Avatar name={p?.nickname} seed={p?.nickname} size={38} />
                      <div className="reqcard__main">
                        <b>
                          {p?.nickname}
                          <span>{p?.major}</span>
                        </b>
                        <p>{r.note || '想加你为好友'}</p>
                      </div>
                      <div className="reqcard__btns">
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => declineRequest(r.id)}>
                          忽略
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={() => {
                            acceptRequest(r.id)
                            toast('已通过')
                          }}
                        >
                          通过
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel__head">
              <div>
                <h3>我发出的（{outgoing.length}）</h3>
                <p>对方通过后会自动成为好友</p>
              </div>
            </div>
            {outgoing.length === 0 ? (
              <p className="panel__text">还没发过申请。</p>
            ) : (
              <div className="reqlist">
                {outgoing.map((r) => {
                  const p = personById(s, r.toId)
                  return (
                    <div className="reqcard" key={r.id}>
                      <Avatar name={p?.nickname} seed={p?.nickname} size={34} />
                      <div className="reqcard__main">
                        <b>{p?.nickname}</b>
                        <p>{fmtRelative(r.at)}发出，等对方处理</p>
                      </div>
                      <span className="pill">申请中</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'find' && (
        <>
          <div className="toolbar">
            <div className="search">
              <Icon name="search" size={17} />
              <input value={q} placeholder="按昵称、专业、兴趣找同学" onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {list.length === 0 ? (
            <Empty
              icon="users"
              title={s.people.length === 0 ? '还没有其他真人注册' : '都加过了'}
              desc={s.people.length === 0 ? '把网址发给同学，他们注册后就会出现在这里。' : '换个关键词试试。'}
            />
          ) : (
            <div className="grid grid--2">
              {list.map(({ person, shared, score }) => (
                <article className="pcard" key={person.id}>
                  <div className="pcard__head">
                    <Link to={`/u/${person.id}`}>
                      <Avatar name={person.nickname} seed={person.nickname} size={46} online={person.online} />
                    </Link>
                    <div className="pcard__id">
                      <h3>
                        <Link to={`/u/${person.id}`}>{person.nickname}</Link>
                      </h3>
                      <p>
                        {person.grade} · {person.major} · {person.campus}
                      </p>
                    </div>
                    {score > 0 && <span className="pill">契合 {score}</span>}
                  </div>
                  <p className="pcard__bio">{person.bio}</p>
                  <div className="pcard__tags">
                    {person.tags.map((t) => (
                      <span className="tag tag--plain" key={t}>
                        #{t}
                      </span>
                    ))}
                  </div>
                  {shared.length > 0 && <p className="pcard__why-line">共同兴趣：{shared.join('、')}</p>}
                  <div className="pcard__foot">
                    <Link to={`/u/${person.id}`} className="btn btn--ghost btn--sm">
                      看主页
                    </Link>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      onClick={() => {
                        sendRequest(person.id, '在校内页看到你，加个好友')
                        toast('好友申请已发出')
                      }}
                    >
                      加好友
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
