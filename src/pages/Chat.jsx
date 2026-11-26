import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, useToast } from '../components/ui'
import { compressImage, readAsDataUrl } from '../lib/image'
import { fmtClock, fmtDay } from '../lib/time'
import { markRead, personById, sendMessage, useStore } from '../lib/store'

const STICKERS = ['😂', '🥹', '😍', '😭', '🤣', '😴', '🤔', '😎', '🥳', '😤', '🙏', '👏', '❤️', '🔥', '👍', '🎉', '🍜', '☕', '📚', '🏸', '🌙', '💪', '🐶', '🍀']

const MAX_VIDEO = 8 * 1024 * 1024
const MAX_AUDIO_SEC = 60

const fmtSec = (n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`

export default function Chat() {
  const { id } = useParams()
  const s = useStore()
  const toast = useToast()
  const [text, setText] = useState('')
  const [showStickers, setShowStickers] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recSec, setRecSec] = useState(0)
  const [zoom, setZoom] = useState('')
  const [busy, setBusy] = useState(false)
  const boxRef = useRef(null)
  const fileRef = useRef(null)
  const recRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

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

  useEffect(() => () => {
    clearInterval(timerRef.current)
    if (recRef.current?.state === 'recording') recRef.current.stop()
  }, [])

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

  /* 图片 / 视频 */
  const pickMedia = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      if (f.type.startsWith('video/')) {
        if (f.size > MAX_VIDEO) throw new Error('视频别超过 8MB')
        const dataUrl = await readAsDataUrl(f)
        sendMessage(conv.id, '', { kind: 'video', media: dataUrl })
        toast('视频已发送')
      } else {
        const dataUrl = await compressImage(f, { maxSide: 1200, quality: 0.78 })
        sendMessage(conv.id, '', { kind: 'image', media: dataUrl })
      }
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  /* 语音 */
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (ev) => ev.data.size && chunksRef.current.push(ev.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        clearInterval(timerRef.current)
        const seconds = recSec
        setRecording(false)
        setRecSec(0)
        if (!chunksRef.current.length) return
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        if (blob.size > 2 * 1024 * 1024) return toast('这段太长了，超过 2MB')
        const dataUrl = await new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.readAsDataURL(blob)
        })
        sendMessage(conv.id, '', { kind: 'audio', media: dataUrl, dur: seconds })
      }
      rec.start()
      recRef.current = rec
      setRecording(true)
      setRecSec(0)
      timerRef.current = setInterval(() => {
        setRecSec((n) => {
          if (n + 1 >= MAX_AUDIO_SEC) {
            rec.stop()
            return MAX_AUDIO_SEC
          }
          return n + 1
        })
      }, 1000)
    } catch {
      toast('需要麦克风权限，浏览器可能拦住了')
    }
  }

  const stopRec = () => {
    if (recRef.current?.state === 'recording') recRef.current.stop()
  }

  return (
    <div className="page chatpage">
      <Link to="/messages" className="backlink">
        <Icon name="arrowLeft" size={15} /> 全部消息
      </Link>

      <div className="chat">
        <header className="chat__head">
          <Avatar name={peer.nickname} seed={peer.nickname} src={peer.avatar} size={40} online={peer.online} />
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
          {msgs.length === 0 && <p className="chat__empty">还没聊过，先打个招呼吧。</p>}
          {msgs.map((m) => (
            <div className={`bubble-row ${m.from === s.me?.id ? 'is-me' : ''}`} key={m.id}>
              {m.from !== s.me?.id && (
                <Avatar name={peer.nickname} seed={peer.nickname} src={peer.avatar} size={30} />
              )}
              <div className={`bubble ${m.kind && m.kind !== 'text' ? 'bubble--media' : ''}`}>
                {(!m.kind || m.kind === 'text') && <p>{m.body}</p>}
                {m.kind === 'image' && (
                  <img className="chat__img" src={m.media} alt="图片" onClick={() => setZoom(m.media)} />
                )}
                {m.kind === 'video' && <video className="chat__video" src={m.media} controls playsInline />}
                {m.kind === 'audio' && (
                  <div className="chat__audio">
                    <audio src={m.media} controls />
                    {m.dur ? <span>{fmtSec(m.dur)}</span> : null}
                  </div>
                )}
                <time>{fmtClock(m.at)}</time>
              </div>
            </div>
          ))}
        </div>

        {showStickers && (
          <div className="stickers">
            {STICKERS.map((emo) => (
              <button
                key={emo}
                type="button"
                onClick={() => {
                  sendMessage(conv.id, emo)
                  setShowStickers(false)
                }}
              >
                {emo}
              </button>
            ))}
          </div>
        )}

        <form className="chat__input" onSubmit={submit}>
          <button type="button" className="chat__tool" title="图片 / 视频" onClick={() => fileRef.current?.click()}>
            <Icon name="image" size={19} />
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" hidden onChange={pickMedia} />
          <button
            type="button"
            className={`chat__tool ${recording ? 'is-rec' : ''}`}
            title={recording ? '点击结束录音' : '发语音'}
            onClick={recording ? stopRec : startRec}
            disabled={busy}
          >
            <Icon name="mic" size={19} />
          </button>
          <button
            type="button"
            className="chat__tool"
            title="表情"
            onClick={() => setShowStickers((v) => !v)}
          >
            <Icon name="smile" size={19} />
          </button>
          <textarea
            rows={1}
            maxLength={2000}
            value={text}
            placeholder={recording ? `录音中 ${fmtSec(recSec)}，再点一下麦克风结束` : `给 ${peer.nickname} 发消息…`}
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

      {zoom && (
        <div className="lightbox" onClick={() => setZoom('')}>
          <img src={zoom} alt="" />
        </div>
      )}
    </div>
  )
}
