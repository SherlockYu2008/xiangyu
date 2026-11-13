import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { Avatar, Modal, Progress, Tag, useToast } from './ui'
import { fmtRelative } from '../lib/time'
import {
  buddyById,
  circleBySlug,
  joinBuddy,
  leaveBuddy,
  personById,
  startChat,
  useStore,
} from '../lib/store'

export default function BuddyDetail({ buddyId, onClose }) {
  const s = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const buddy = buddyId ? buddyById(s, buddyId) : null

  if (!buddy) return null

  const author = personById(s, buddy.author)
  const circle = circleBySlug(s, buddy.circle)
  const uid = s.me?.id
  const joined = Boolean(uid) && buddy.members.includes(uid)
  const full = buddy.members.length >= buddy.capacity
  const isSelf = uid === buddy.author

  const toggle = () => {
    if (joined) {
      leaveBuddy(buddy.id)
      toast('已退出这个搭子')
      return
    }
    if (full) {
      toast('人数已满，去圈子里看看别的搭子')
      return
    }
    joinBuddy(buddy.id)
    toast('加入成功，可以私信发起人了')
  }

  const chat = () => {
    if (isSelf) {
      toast('这是你自己发的搭子')
      return
    }
    const id = startChat(buddy.author)
    onClose?.()
    if (id) nav(`/messages/${id}`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={buddy.title}
      subtitle={`${circle?.emoji} ${circle?.name} · ${fmtRelative(buddy.createdAt)}发起`}
      width={600}
      footer={
        <div className="buddy-foot">
          <span className="buddy-foot__hint">
            <Icon name="users" size={15} />
            {buddy.members.length} / {buddy.capacity} 人
          </span>
          <div className="buddy-foot__btns">
            <button type="button" className="btn btn--ghost btn--sm" onClick={chat} disabled={isSelf}>
              <Icon name="chat" size={15} /> {isSelf ? '你自己发起的' : '私信发起人'}
            </button>
            <button
              type="button"
              className={`btn btn--sm ${isSelf ? 'btn--soft' : joined ? 'btn--ghost' : full ? 'btn--soft' : 'btn--primary'}`}
              onClick={toggle}
              disabled={isSelf}
            >
              {isSelf ? '发起人' : joined ? '退出搭子' : full ? '已满员' : '加入搭子'}
            </button>
          </div>
        </div>
      }
    >
      <div className="bd">
        <div className="bd__host">
          <Avatar name={author?.nickname} seed={author?.nickname} size={44} online={author?.online} />
          <div>
            <b>{author?.nickname}</b>
            <span>
              {author?.grade} · {author?.major} · {author?.campus}
            </span>
          </div>
        </div>

        <p className="bd__intro">{buddy.intro}</p>

        <div className="bd__grid">
          <div>
            <span className="bd__k">
              <Icon name="clock" size={14} /> 时间
            </span>
            <b>{buddy.time}</b>
          </div>
          <div>
            <span className="bd__k">
              <Icon name="pin" size={14} /> 地点
            </span>
            <b>{buddy.place}</b>
          </div>
        </div>

        <div className="bd__tags">
          {buddy.tags.map((t) => (
            <Tag key={t} tone="plain">
              #{t}
            </Tag>
          ))}
        </div>

        <div className="bd__block">
          <div className="bd__blockhead">
            <b>已经上车的人</b>
            <span>{buddy.members.length} / {buddy.capacity}</span>
          </div>
          <Progress value={buddy.members.length} max={buddy.capacity} />
          <div className="bd__members">
            {buddy.members.map((mid) => {
              const p = personById(s, mid)
              return (
                <span className="bd__member" key={mid}>
                  <Avatar name={p?.nickname} seed={p?.nickname} size={26} />
                  {p?.nickname}
                  {mid === buddy.author && <i>发起人</i>}
                </span>
              )
            })}
            {Array.from({ length: Math.max(0, buddy.capacity - buddy.members.length) }).map((_, i) => (
              <span className="bd__member bd__member--empty" key={`e${i}`}>
                <span className="bd__slot" />
                还差 {i + 1} 个
              </span>
            ))}
          </div>
        </div>

        <p className="bd__note">
          <Icon name="shield" size={14} />
          约见请在校内公共场合，第一次见面别单独行动。平台不提供撮合担保。
        </p>
      </div>
    </Modal>
  )
}
