import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty } from '../components/ui'
import { fmtClock, fmtDay } from '../lib/time'
import { markRead, personById, sendMessage, useStore } from '../lib/store'

export default function Chat() {
  const { id } = useParams()
  const s = useStore()
  const [text, setText] = useState('')
  const boxRef = useRef(null)

  const conv = s.conversations.find((c) => c.id === id)
  const peer = conv ? personById(s, conv.peerId) : null
  const msgs = s.messages[id] || []

  useEffect(() => {
    if (conv && conv.unread) markRead(conv.id)
  }, [conv])

  useEffect(() => {
    const el = boxRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length])

  if (!conv || !peer) {
    return (
      <div className="page">
        <Empty
          icon="chat"
          title="这个会话不存在"
          desc="可能被清空了，回消息列表看看。"
          action={
            <Link to="/messages" className="btn btn--primary btn--sm">
              回到消息
            </Link>
          }
        />
      </div>
    )
  }

  const submit = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    sendMessage(conv.id, text)
    setText('')
  }

  return (
    <div className="page chatpage">
      <Link to="/messages" className="backlink">
        <Icon name="arrowLeft" size={15} /> 全部消息
      </Link>

      <div className="chat">
        <header className="chat__head">
          <Avatar name={peer.nickname} seed={peer.nickname} size={40} online={peer.online} />
          <div>
            <b>{peer.nickname}</b>
            <span>
              {peer.grade} · {peer.major} · {peer.campus} · {peer.online ? '在线' : '离线'}
            </span>
          </div>
          <span className="chat__safe">
            <Icon name="shield" size={14} /> 仅你们两人可见
          </span>
        </header>

        <div className="chat__box" ref={boxRef}>
          <div className="chat__day">{fmtDay(msgs[0]?.at || Date.now())}</div>
          {msgs.length === 0 && (
            <p className="chat__empty">还没聊过。可以先用 AI 生成一句破冰的话（会消耗 1 次额度）。</p>
          )}
          {msgs.map((m) => (
            <div className={`bubble-row ${m.from === s.me?.id ? 'is-me' : ''}`} key={m.id}>
              {m.from !== s.me?.id && <Avatar name={peer.nickname} seed={peer.nickname} size={30} />}
              <div className="bubble">
                <p>{m.body}</p>
                <time>{fmtClock(m.at)}</time>
              </div>
            </div>
          ))}
        </div>

        <form className="chat__input" onSubmit={submit}>
          <textarea
            rows={1}
            maxLength={2000}
            value={text}
            placeholder={`给 ${peer.nickname} 发消息…（Enter 发送，Shift+Enter 换行）`}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submit(e)
            }}
          />
          <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
            <Icon name="send" size={17} /> 发送
          </button>
        </form>
      </div>
    </div>
  )
}
