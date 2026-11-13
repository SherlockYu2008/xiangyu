import { useState } from 'react'
import Icon from './Icon'
import { Modal, Tag, useToast } from './ui'
import { TAG_POOL } from '../lib/data'
import { createBuddy, useStore } from '../lib/store'

export default function CreateBuddy({ open, onClose, defaultCircle = 'study' }) {
  const s = useStore()
  const toast = useToast()
  const [form, setForm] = useState({
    circle: defaultCircle,
    title: '',
    time: '',
    place: '',
    capacity: 4,
    intro: '',
  })
  const [tags, setTags] = useState([])

  const toggle = (t) =>
    setTags((list) => (list.includes(t) ? list.filter((x) => x !== t) : list.length >= 3 ? list : [...list, t]))

  const submit = () => {
    if (!form.title.trim()) return toast('给搭子起个标题，比如「羽毛球搭子 · 缺 2 人」')
    if (!form.time.trim()) return toast('写一下时间，别人才知道能不能来')
    if (!form.place.trim()) return toast('写个地点，校内公共场合最好')
    createBuddy({ ...form, title: form.title.trim(), tags })
    toast('搭子已发布，等别人来上车')
    setForm({ circle: defaultCircle, title: '', time: '', place: '', capacity: 4, intro: '' })
    setTags([])
    onClose?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="发起一个搭子"
      subtitle="写清楚时间、地点、人数，比“有人吗”有效 10 倍"
      width={580}
      footer={
        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn btn--primary" onClick={submit}>
            发布搭子
          </button>
        </div>
      }
    >
      <div className="form">
        <label className="field">
          <span>放到哪个圈子</span>
          <select value={form.circle} onChange={(e) => setForm({ ...form, circle: e.target.value })}>
            {s.circles.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>标题</span>
          <input
            maxLength={40}
            value={form.title}
            placeholder="羽毛球搭子 · 双打缺 2 人"
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>时间</span>
            <input
              maxLength={30}
              value={form.time}
              placeholder="每周二/四 18:30"
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </label>
          <label className="field">
            <span>人数上限</span>
            <input
              type="number"
              min={2}
              max={50}
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: Math.max(2, Math.min(50, Number(e.target.value) || 2)) })}
            />
          </label>
        </div>

        <label className="field">
          <span>地点</span>
          <input
            maxLength={40}
            value={form.place}
            placeholder="四方 · 体育馆 2 号场"
            onChange={(e) => setForm({ ...form, place: e.target.value })}
          />
        </label>

        <div className="field">
          <span>
            标签 <i>最多 3 个</i>
          </span>
          <div className="tagpool">
            {TAG_POOL.slice(0, 24).map((t) => (
              <Tag key={t} tone={tags.includes(t) ? 'brand' : 'plain'} active={tags.includes(t)} onClick={() => toggle(t)}>
                {t}
              </Tag>
            ))}
          </div>
        </div>

        <label className="field">
          <span>说明</span>
          <textarea
            rows={3}
            maxLength={200}
            value={form.intro}
            placeholder="水平不限，主要图个开心；放鸽子提前说一声。"
            onChange={(e) => setForm({ ...form, intro: e.target.value })}
          />
        </label>

        <p className="form__note">
          <Icon name="shield" size={14} />
          请不要写手机号、微信号或宿舍号；平台内私信足够用。
        </p>
      </div>
    </Modal>
  )
}
