import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { Avatar, Modal, Tag, useToast } from './ui'
import { fmtRelative, fmtClock } from '../lib/time'
import { compressImage } from '../lib/image'
import {
  addComment,
  adminDeletePost,
  adminPinPost,
  createPost,
  deletePost,
  isAdmin,
  personById,
  removeComment,
  toggleLike,
  useStore,
} from '../lib/store'

const MOODS = ['', '😀 开心', '😮‍💨 累', '📚 在自习', '🏸 想运动', '🌙 失眠', '🍜 觅食']

export function PostCard({ post }) {
  const s = useStore()
  const toast = useToast()
  const author = personById(s, post.authorId)
  const mine = post.authorId === s.me?.id
  const admin = isAdmin(s)
  const canModerate = mine || admin
  const liked = post.likes.includes(s.me?.id)
  const [commenting, setCommenting] = useState(false)
  const [text, setText] = useState('')
  const [zoom, setZoom] = useState(null)
  const [pop, setPop] = useState(false)

  const like = () => {
    toggleLike(post.id)
    if (!liked) {
      setPop(true)
      setTimeout(() => setPop(false), 460)
    }
  }

  const submit = () => {
    if (!text.trim()) return
    addComment(post.id, text)
    setText('')
    setCommenting(false)
    toast('评论已发送')
  }

  return (
    <article className="post">
      <header className="post__head">
        <Link to={`/u/${post.authorId}`}>
          <Avatar name={author?.nickname} seed={author?.nickname} size={40} online={author?.online} />
        </Link>
        <div className="post__who">
          <Link to={`/u/${post.authorId}`} className="post__name">
            {author?.nickname || '已注销用户'}
          </Link>
          <span>
            {author?.grade} · {author?.major} · {author?.campus}
          </span>
        </div>
        {post.pinned && <span className="chip chip--flame">置顶</span>}
        <time>{fmtRelative(post.createdAt)}</time>
        {admin && !mine && (
          <button
            type="button"
            className="icon-btn post__del"
            aria-label={post.pinned ? '取消置顶' : '置顶'}
            title={post.pinned ? '取消置顶' : '置顶这条'}
            onClick={() => {
              adminPinPost(post.id, !post.pinned)
              toast(post.pinned ? '已取消置顶' : '已置顶')
            }}
          >
            <Icon name="star" size={15} />
          </button>
        )}
        {canModerate && (
          <button
            type="button"
            className="icon-btn post__del"
            aria-label="删除"
            title={mine ? '删除' : '管理员删除'}
            onClick={() => {
              if (mine) deletePost(post.id)
              else adminDeletePost(post.id)
              toast('动态已删除')
            }}
          >
            <Icon name="x" size={15} />
          </button>
        )}
      </header>

      {post.mood && <p className="post__mood">{post.mood}</p>}
      {post.text && <p className="post__text">{post.text}</p>}

      {post.images.length > 0 && (
        <div className={`post__imgs post__imgs--${Math.min(post.images.length, 3)}`}>
          {post.images.map((src, i) => (
            <button type="button" key={i} onClick={() => setZoom(src)} className="post__imgbtn">
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      <footer className="post__acts">
        <button type="button" className={`post__act ${liked ? 'is-on' : ''} ${pop ? 'is-pop' : ''}`} onClick={like}>
          <Icon name="heart" size={16} fill={liked ? 'currentColor' : 'none'} />
          {post.likes.length > 0 ? post.likes.length : '赞'}
          {pop && <span className="heart-float">♥</span>}
        </button>
        <button type="button" className="post__act" onClick={() => setCommenting((v) => !v)}>
          <Icon name="chat" size={16} />
          {post.comments.length > 0 ? post.comments.length : '评论'}
        </button>
        {post.likes.length > 0 && (
          <span className="post__likers">
            {post.likes
              .slice(0, 3)
              .map((id) => personById(s, id)?.nickname)
              .filter(Boolean)
              .join('、')}
            {post.likes.length > 3 ? ' 等' : ''} 赞了
          </span>
        )}
      </footer>

      {(post.comments.length > 0 || commenting) && (
        <div className="post__comments">
          {post.comments.map((c) => {
            const from = personById(s, c.from)
            return (
              <div className="comment" key={c.id}>
                <Link to={`/u/${c.from}`}>
                  <Avatar name={from?.nickname} seed={from?.nickname} size={24} />
                </Link>
                <p>
                  <Link to={`/u/${c.from}`} className="comment__name">
                    {from?.nickname}
                  </Link>
                  {c.text}
                  <time>{fmtClock(c.at)}</time>
                </p>
                {c.from === s.me?.id && (
                  <button type="button" className="comment__del" onClick={() => removeComment(post.id, c.id)}>
                    删除
                  </button>
                )}
              </div>
            )
          })}

          {commenting && (
            <div className="comment__input">
              <input
                autoFocus
                value={text}
                maxLength={300}
                placeholder="说点什么…（Enter 发送）"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
              <button type="button" className="btn btn--primary btn--sm" onClick={submit} disabled={!text.trim()}>
                发送
              </button>
            </div>
          )}
        </div>
      )}

      <Modal open={Boolean(zoom)} onClose={() => setZoom(null)} title="照片" width={900}>
        {zoom && <img src={zoom} alt="" style={{ width: '100%', borderRadius: 12 }} />}
      </Modal>
    </article>
  )
}

export function Composer({ onDone }) {
  const s = useStore()
  const toast = useToast()
  const fileRef = useRef(null)
  const [text, setText] = useState('')
  const [mood, setMood] = useState('')
  const [images, setImages] = useState([])
  const [busy, setBusy] = useState(false)

  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 9 - images.length)
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      const next = []
      for (const f of files) next.push(await compressImage(f))
      setImages((list) => [...list, ...next].slice(0, 9))
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  const publish = () => {
    if (!text.trim() && images.length === 0) return toast('写点什么，或者加张照片')
    try {
      createPost({ text, images, mood })
      setText('')
      setImages([])
      setMood('')
      toast('发布成功')
      onDone?.()
    } catch {
      toast('本机存储满了，删掉一些旧照片再试')
    }
  }

  return (
    <section className="composer">
      <div className="composer__top">
        <Avatar name={s.me?.nickname} seed={s.me?.nickname} size={40} />
        <textarea
          rows={2}
          maxLength={1000}
          value={text}
          placeholder={`${s.me?.nickname}，今天有什么新鲜事？`}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {images.length > 0 && (
        <div className="composer__imgs">
          {images.map((src, i) => (
            <div key={i} className="composer__thumb">
              <img src={src} alt="" />
              <button type="button" onClick={() => setImages((l) => l.filter((_, x) => x !== i))} aria-label="移除">
                <Icon name="x" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="composer__bar">
        <button type="button" className="composer__tool" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Icon name="image" size={16} /> {busy ? '处理中…' : '照片'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />

        <select className="composer__mood" value={mood} onChange={(e) => setMood(e.target.value)}>
          {MOODS.map((m) => (
            <option key={m} value={m}>
              {m || '心情'}
            </option>
          ))}
        </select>

        <span className="composer__count">{text.length}/1000</span>
        <button type="button" className="btn btn--primary btn--sm" onClick={publish} disabled={busy}>
          发布
        </button>
      </div>
    </section>
  )
}

export function PhotoStrip({ photos = [], onOpen }) {
  if (!photos.length) return null
  return (
    <div className="photostrip">
      {photos.slice(0, 8).map((p) => (
        <button type="button" key={p.id} className="photostrip__item" onClick={() => onOpen?.(p)}>
          <img src={p.dataUrl} alt={p.caption || ''} loading="lazy" />
        </button>
      ))}
    </div>
  )
}

export function EmptyHint({ children }) {
  return (
    <p className="emptyhint">
      <Icon name="sparkles" size={14} /> {children}
    </p>
  )
}

export const MoodTag = ({ mood }) => (mood ? <Tag tone="plain">{mood}</Tag> : null)
