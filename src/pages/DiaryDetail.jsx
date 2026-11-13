import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, useToast } from '../components/ui'
import { fmtDate, fmtClock } from '../lib/time'
import { addComment, deleteDiary, personById, removeComment, toggleLike, useStore } from '../lib/store'

export default function DiaryDetail() {
  const { id } = useParams()
  const s = useStore()
  const toast = useToast()
  const [text, setText] = useState('')

  const diary = s.diaries.find((d) => d.id === id)
  if (!diary) {
    return (
      <div className="page">
        <Empty icon="book" title="日志不存在" desc="可能已经被作者删掉了。" action={<Link to="/diary" className="btn btn--primary btn--sm">回日志</Link>} />
      </div>
    )
  }

  const author = personById(s, diary.authorId)
  const mine = diary.authorId === s.me?.id
  const liked = diary.likes.includes(s.me?.id)

  const submit = () => {
    if (!text.trim()) return
    addComment(diary.id, text)
    setText('')
    toast('评论已发送')
  }

  return (
    <div className="page">
      <Link to="/diary" className="backlink">
        <Icon name="arrowLeft" size={15} /> 全部日志
      </Link>

      <article className="article">
        <header className="article__head">
          <h1>{diary.title}</h1>
          <div className="article__meta">
            <Link to={`/u/${diary.authorId}`} className="article__author">
              <Avatar name={author?.nickname} seed={author?.nickname} size={34} />
              <span>
                <b>{author?.nickname}</b>
                <i>
                  {author?.grade} · {author?.major}
                </i>
              </span>
            </Link>
            <time>
              {fmtDate(diary.createdAt)} {fmtClock(diary.createdAt)}
            </time>
          </div>
        </header>

        <div className="article__body">{diary.body}</div>

        <footer className="article__foot">
          <button type="button" className={`post__act ${liked ? 'is-on' : ''}`} onClick={() => toggleLike(diary.id)}>
            <Icon name="heart" size={16} fill={liked ? 'currentColor' : 'none'} />
            {diary.likes.length > 0 ? `${diary.likes.length} 赞` : '赞'}
          </button>
          <span className="post__act">{diary.comments.length} 条评论</span>
          {mine && (
            <button
              type="button"
              className="btn btn--ghost btn--sm dangerbtn"
              onClick={() => {
                deleteDiary(diary.id)
                window.location.hash = '#/diary'
              }}
            >
              删除
            </button>
          )}
        </footer>
      </article>

      <section className="panel">
        <div className="panel__head">
          <div>
            <h3>评论（{diary.comments.length}）</h3>
          </div>
        </div>

        {diary.comments.map((c) => {
          const from = personById(s, c.from)
          return (
            <div className="comment" key={c.id}>
              <Link to={`/u/${c.from}`}>
                <Avatar name={from?.nickname} seed={from?.nickname} size={28} />
              </Link>
              <p>
                <Link to={`/u/${c.from}`} className="comment__name">
                  {from?.nickname}
                </Link>
                {c.text}
                <time>{fmtClock(c.at)}</time>
              </p>
              {c.from === s.me?.id && (
                <button type="button" className="comment__del" onClick={() => removeComment(diary.id, c.id)}>
                  删除
                </button>
              )}
            </div>
          )
        })}

        <div className="comment__input">
          <input
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
      </section>
    </div>
  )
}
