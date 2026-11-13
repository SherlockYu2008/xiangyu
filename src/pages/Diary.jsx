import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, Modal, useToast } from '../components/ui'
import { fmtDate } from '../lib/time'
import { createDiary, personById, useStore } from '../lib/store'

export default function Diary() {
  const s = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', body: '' })

  const list = [...s.diaries].sort((a, b) => b.createdAt - a.createdAt)

  const submit = () => {
    if (!form.title.trim()) return toast('给日志起个标题')
    if (!form.body.trim()) return toast('正文还没有内容')
    const id = createDiary(form)
    setOpen(false)
    setForm({ title: '', body: '' })
    if (id) {
      toast('日志已发布')
      window.location.hash = `#/diary/${id}`
    }
  }

  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">日志</span>
          <h1>写点长的</h1>
          <p>动态用来发牢骚，日志用来讲清楚一件事。</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
          <Icon name="edit" size={16} /> 写日志
        </button>
      </header>

      {list.length === 0 ? (
        <Empty
          icon="book"
          title="还没有人写日志"
          desc="第一篇通常最难写。写这周干了什么就行。"
          action={<button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>写第一篇</button>}
        />
      ) : (
        <div className="diarylist">
          {list.map((d) => {
            const author = personById(s, d.authorId)
            return (
              <Link to={`/diary/${d.id}`} className="diaryrow" key={d.id}>
                <div className="diaryrow__head">
                  <Avatar name={author?.nickname} seed={author?.nickname} size={30} />
                  <b>{author?.nickname}</b>
                  <time>{fmtDate(d.createdAt)}</time>
                </div>
                <h3>{d.title}</h3>
                <p>{d.body.slice(0, 160)}</p>
                <span className="diaryrow__stats">
                  {d.likes.length} 赞 · {d.comments.length} 评论
                </span>
              </Link>
            )
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="写日志"
        subtitle="正文最多 8000 字，先写再改"
        width={640}
        footer={
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
              取消
            </button>
            <button type="button" className="btn btn--primary" onClick={submit}>
              发布
            </button>
          </div>
        }
      >
        <div className="form">
          <label className="field">
            <span>标题</span>
            <input
              value={form.title}
              maxLength={60}
              placeholder="比如：这周在崂山跑了三次步"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="field">
            <span>正文</span>
            <textarea
              rows={10}
              maxLength={8000}
              value={form.body}
              placeholder="随便写，没人催你。"
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
        </div>
      </Modal>
    </div>
  )
}
