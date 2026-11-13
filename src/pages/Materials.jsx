import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, Modal, useToast } from '../components/ui'
import { readAsDataUrl } from '../lib/image'
import { fmtRelative } from '../lib/time'
import {
  addMaterial,
  deleteMaterial,
  downloadMaterial,
  isAdmin,
  personById,
  useStore,
} from '../lib/store'

const COURSES = [
  '高等数学', '大学物理', '大学英语', '四级', '六级', '数据结构',
  '有机化学', '高分子化学', '机械设计', '电路', '考研', '其他',
]

const TYPE_LABEL = {
  pdf: { text: 'PDF', tone: 'rose' },
  doc: { text: 'DOC', tone: 'blue' },
  docx: { text: 'DOCX', tone: 'blue' },
  ppt: { text: 'PPT', tone: 'amber' },
  pptx: { text: 'PPTX', tone: 'amber' },
  zip: { text: 'ZIP', tone: 'violet' },
  png: { text: '图片', tone: 'mint' },
  jpg: { text: '图片', tone: 'mint' },
  jpeg: { text: '图片', tone: 'mint' },
}

const sizeText = (n) => {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function Materials() {
  const s = useStore()
  const toast = useToast()
  const fileRef = useRef(null)
  const [q, setQ] = useState('')
  const [course, setCourse] = useState('全部')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ title: '', course: '高等数学', desc: '', fileName: '', size: 0, dataUrl: '' })

  const list = useMemo(() => {
    const kw = q.trim()
    return [...s.materials]
      .filter((m) => (course === '全部' || m.course === course) && (!kw || m.title.includes(kw) || m.desc.includes(kw) || m.course.includes(kw)))
      .sort((a, b) => b.createdAt - a.createdAt)
  }, [s.materials, q, course])

  const courses = useMemo(() => ['全部', ...new Set([...COURSES, ...s.materials.map((m) => m.course).filter(Boolean)])], [s.materials])

  const pick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (f.size > 8 * 1024 * 1024) return toast('文件别超过 8MB')
    setBusy(true)
    try {
      const dataUrl = await readAsDataUrl(f)
      setForm((x) => ({
        ...x,
        dataUrl,
        fileName: f.name,
        size: f.size,
        title: x.title || f.name.replace(/\.[^.]+$/, ''),
      }))
      toast('文件已选好，填个标题就能发布')
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    if (!form.dataUrl) return toast('先选一个文件')
    if (!form.title.trim()) return toast('给它起个标题，方便别人搜到')
    addMaterial(form)
    setOpen(false)
    setForm({ title: '', course: '高等数学', desc: '', fileName: '', size: 0, dataUrl: '' })
    toast('已发布，其他人可以下载了')
  }

  const mine = (m) => m.ownerId === s.me?.id || isAdmin(s)

  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">学习圈 · 资料</span>
          <h1>资料库</h1>
          <p>期末真题、课堂笔记、课件、模板。上传前请确认你有权分享。</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>
          <Icon name="plus" size={17} /> 上传资料
        </button>
      </header>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={17} />
          <input value={q} placeholder="搜资料名、课程、关键词" onChange={(e) => setQ(e.target.value)} />
        </div>
        <span className="pill">{list.length} 份</span>
      </div>

      <div className="chips">
        {courses.slice(0, 12).map((c) => (
          <span
            key={c}
            className={`tag tag--btn ${course === c ? 'tag--brand is-active' : 'tag--plain'}`}
            onClick={() => setCourse(c)}
            role="button"
            tabIndex={0}
          >
            {c}
          </span>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty
          icon="book"
          title={s.materials.length === 0 ? '还没有人上传资料' : '没有搜到'}
          desc={s.materials.length === 0 ? '把你的课堂笔记传上来，别人也会传给你的。' : '换个关键词或课程试试。'}
          action={
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>
              上传第一份
            </button>
          }
        />
      ) : (
        <div className="matgrid">
          {list.map((m) => {
            const owner = personById(s, m.ownerId)
            const t = TYPE_LABEL[m.kind] || { text: (m.kind || '文件').toUpperCase().slice(0, 4), tone: 'violet' }
            return (
              <article className="matcard" key={m.id}>
                <span className={`matcard__type chip chip--${t.tone}`}>{t.text}</span>
                <h3>{m.title}</h3>
                <p className="matcard__desc">{m.desc || '没有写说明'}</p>
                <div className="matcard__tags">
                  {m.course && <span className="tag tag--plain">{m.course}</span>}
                  {m.size ? <span className="tag tag--plain">{sizeText(m.size)}</span> : null}
                </div>
                <div className="matcard__foot">
                  <span className="matcard__who">
                    <Avatar name={owner?.nickname} seed={owner?.nickname} size={22} />
                    {owner?.nickname || '已注销'}
                    <i>{fmtRelative(m.createdAt)}</i>
                  </span>
                  <span className="matcard__dl">
                    <Icon name="arrowRight" size={13} /> {m.downloads || 0}
                  </span>
                </div>
                <div className="matcard__acts">
                  <a
                    className="btn btn--primary btn--sm"
                    href={m.dataUrl || m.url}
                    download={m.title}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => downloadMaterial(m.id)}
                  >
                    下载
                  </a>
                  {mine(m) && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm dangerbtn"
                      onClick={() => {
                        deleteMaterial(m.id)
                        toast('已删除')
                      }}
                    >
                      删除
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <p className="footnote">
        <Icon name="shield" size={14} />
        请勿上传受版权保护的教材原书、付费网课；只传自己的笔记、公开课链接或有权分享的材料。
        <Link to="/" style={{ marginLeft: 6 }}>
          回首页
        </Link>
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="上传资料"
        subtitle="支持 PDF / Word / PPT / 图片 / ZIP，单个不超过 8MB"
        width={560}
        footer={
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>
              取消
            </button>
            <button type="button" className="btn btn--primary" onClick={submit} disabled={busy}>
              发布
            </button>
          </div>
        }
      >
        <div className="form">
          <div className="field">
            <span>文件</span>
            <div className="uploadbox" onClick={() => fileRef.current?.click()}>
              {form.fileName ? (
                <>
                  <b>{form.fileName}</b>
                  <i>{sizeText(form.size)} · 点击重新选择</i>
                </>
              ) : (
                <>
                  <b>{busy ? '读取中…' : '点击选择文件'}</b>
                  <i>PDF / DOCX / PPTX / 图片 / ZIP</i>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.txt,.md,image/*"
              onChange={pick}
            />
          </div>

          <label className="field">
            <span>标题</span>
            <input
              value={form.title}
              maxLength={60}
              placeholder="比如：高数上册期末重点整理"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>

          <div className="field-row">
            <label className="field">
              <span>课程</span>
              <select value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })}>
                {COURSES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>说明（选填）</span>
              <input
                value={form.desc}
                maxLength={100}
                placeholder="适合谁看、覆盖哪几章"
                onChange={(e) => setForm({ ...form, desc: e.target.value })}
              />
            </label>
          </div>

          <p className="form__note">
            <Icon name="shield" size={14} />
            上传即表示你确认有权分享这份材料。
          </p>
        </div>
      </Modal>
    </div>
  )
}
