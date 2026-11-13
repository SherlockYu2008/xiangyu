import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, Modal, useToast } from '../components/ui'
import { compressImage } from '../lib/image'
import { fmtDate } from '../lib/time'
import { addPhoto, deleteAlbum, deletePhoto, personById, useStore } from '../lib/store'

export default function AlbumDetail() {
  const { id } = useParams()
  const s = useStore()
  const toast = useToast()
  const fileRef = useRef(null)
  const [zoom, setZoom] = useState(null)
  const [busy, setBusy] = useState(false)

  const album = s.albums.find((a) => a.id === id)
  if (!album) {
    return (
      <div className="page">
        <Empty icon="image" title="相册不存在" desc="可能已经被删掉了。" action={<Link to="/albums" className="btn btn--primary btn--sm">回相册</Link>} />
      </div>
    )
  }

  const owner = personById(s, album.ownerId)
  const mine = album.ownerId === s.me?.id

  const upload = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 24 - album.photos.length)
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    let added = 0
    try {
      for (const f of files) {
        const dataUrl = await compressImage(f)
        if (addPhoto(album.id, dataUrl)) added += 1
        else {
          toast('相册满了（24 张）')
          break
        }
      }
      if (added) toast(`已上传 ${added} 张`)
    } catch (err) {
      toast(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Link to="/albums" className="backlink">
        <Icon name="arrowLeft" size={15} /> 全部相册
      </Link>

      <header className="pagehead">
        <div>
          <h1>{album.name}</h1>
          <p>
            {owner?.nickname} 的相册 · {album.photos.length} 张 · {fmtDate(album.createdAt)}
          </p>
        </div>
        {mine && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn--ghost" onClick={() => { deleteAlbum(album.id); window.location.hash = '#/albums' }}>删除相册</button>
            <button type="button" className="btn btn--primary" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name="camera" size={17} /> {busy ? '处理中…' : '上传照片'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={upload} />
          </div>
        )}
      </header>

      {album.photos.length === 0 ? (
        <Empty
          icon="camera"
          title="还没有照片"
          desc={mine ? '传几张上来吧，会压缩到 900px 再存。' : 'TA 还没往这个相册里放照片。'}
          action={mine ? <button type="button" className="btn btn--primary btn--sm" onClick={() => fileRef.current?.click()}>上传照片</button> : null}
        />
      ) : (
        <div className="photogrid">
          {album.photos.map((p) => (
            <figure className="photo" key={p.id}>
              <button type="button" onClick={() => setZoom(p)} className="photo__btn">
                <img src={p.dataUrl} alt={p.caption || ''} loading="lazy" />
              </button>
              <figcaption>
                <span>{p.caption || '未命名'}</span>
                {mine && (
                  <button type="button" onClick={() => deletePhoto(album.id, p.id)} aria-label="删除">
                    <Icon name="x" size={13} />
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <Modal open={Boolean(zoom)} onClose={() => setZoom(null)} title={zoom?.caption || '照片'} width={900}>
        {zoom && (
          <div>
            <img src={zoom.dataUrl} alt="" style={{ width: '100%', borderRadius: 12 }} />
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
              <Avatar name={owner?.nickname} seed={owner?.nickname} size={20} /> {owner?.nickname} · {fmtDate(zoom.at)}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
