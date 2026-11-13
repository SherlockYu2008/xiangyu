import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, Modal, useToast } from '../components/ui'
import { fmtDate } from '../lib/time'
import { createAlbum, personById, useStore } from '../lib/store'

export default function Albums() {
  const s = useStore()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const albums = [...s.albums].sort((a, b) => b.createdAt - a.createdAt)

  const submit = () => {
    if (!name.trim()) return toast('给相册起个名字')
    const id = createAlbum(name)
    setName('')
    setCreating(false)
    if (id) toast('相册建好了，进去传照片')
  }

  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">相册</span>
          <h1>照片墙</h1>
          <p>校内网最费流量的地方。照片会压到 900px 再保存：共享模式存在服务器，本机模式只在你浏览器里。</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={17} /> 新建相册
        </button>
      </header>

      {albums.length === 0 ? (
        <Empty
          icon="image"
          title="还没有任何相册"
          desc="建一个相册，把手机里的照片传上来，好友就能看了。"
          action={
            <button type="button" className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
              新建相册
            </button>
          }
        />
      ) : (
        <div className="albumgrid">
          {albums.map((a) => {
            const owner = personById(s, a.ownerId)
            return (
              <Link to={`/albums/${a.id}`} className="albumcard" key={a.id}>
                <div className="albumcard__cover">
                  {a.photos[0] ? <img src={a.photos[0].dataUrl} alt="" loading="lazy" /> : <span>📷</span>}
                  <i className="albumcard__num">{a.photos.length}</i>
                </div>
                <div className="albumcard__meta">
                  <b>{a.name}</b>
                  <span>
                    {owner?.nickname} · {fmtDate(a.createdAt)}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="新建相册"
        width={420}
        footer={
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={() => setCreating(false)}>
              取消
            </button>
            <button type="button" className="btn btn--primary" onClick={submit}>
              建好
            </button>
          </div>
        }
      >
        <label className="field">
          <span>相册名</span>
          <input value={name} maxLength={20} placeholder="比如：崂山的秋天" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </label>
      </Modal>

      <p className="footnote">
        <Icon name="shield" size={14} />
        本机浏览器大约能存 5MB，装满了就先删点旧照片。
      </p>
    </div>
  )
}
