import { Link } from 'react-router-dom'
import Icon from './Icon'
import { Avatar, Progress, ScoreRing, Tag, useToast } from './ui'
import { fmtRelative } from '../lib/time'
import { circleBySlug, joinBuddy, leaveBuddy, personById, useStore } from '../lib/store'

/* ---------------- 搭子卡 ---------------- */

export function BuddyCard({ buddy, onOpen }) {
  const s = useStore()
  const toast = useToast()
  const author = personById(s, buddy.author)
  const circle = circleBySlug(s, buddy.circle)
  const uid = s.me?.id
  const joined = Boolean(uid) && buddy.members.includes(uid)
  const count = buddy.members.length
  const full = count >= buddy.capacity

  const toggle = (e) => {
    e.stopPropagation()
    if (joined) {
      leaveBuddy(buddy.id)
      toast('已退出，名额放回去了')
      return
    }
    if (full) {
      toast('已经满了，去圈子里蹲个新的吧')
      return
    }
    joinBuddy(buddy.id)
    toast('加入成功，去消息里打个招呼')
  }

  return (
    <article className={`bcard ${buddy.hot ? 'bcard--hot' : ''}`} onClick={() => onOpen?.(buddy)}>
      <div className="bcard__top">
        <span className={`chip chip--${circle?.tone || 'violet'}`}>
          {circle?.emoji} {circle?.name}
        </span>
        {buddy.hot && (
          <span className="chip chip--flame">
            <Icon name="flame" size={12} /> 热
          </span>
        )}
        <time>{fmtRelative(buddy.createdAt)}</time>
      </div>

      <h3 className="bcard__title">{buddy.title}</h3>
      <p className="bcard__intro">{buddy.intro}</p>

      <div className="bcard__meta">
        <span>
          <Icon name="clock" size={14} />
          {buddy.time}
        </span>
        <span>
          <Icon name="pin" size={14} />
          {buddy.place}
        </span>
      </div>

      <div className="bcard__tags">
        {buddy.tags.map((t) => (
          <Tag key={t} tone="plain">
            #{t}
          </Tag>
        ))}
      </div>

      <div className="bcard__foot">
        <div className="bcard__host">
          <Avatar name={author?.nickname} seed={author?.nickname} size={28} />
          <div>
            <b>{author?.nickname}</b>
            <span>
              {author?.grade} · {author?.major}
            </span>
          </div>
        </div>

        <div className="bcard__slot">
          <div className="bcard__count">
            <b>{count}</b>/{buddy.capacity}
            <span>人</span>
          </div>
          <Progress value={count} max={buddy.capacity} tone={full ? 'full' : 'brand'} />
        </div>

        <button
          type="button"
          className={`btn btn--sm ${joined ? 'btn--ghost' : full ? 'btn--soft' : 'btn--primary'}`}
          onClick={toggle}
        >
          {joined ? '已加入' : full ? '已满' : '加入'}
        </button>
      </div>
    </article>
  )
}

/* ---------------- 圈子卡 ---------------- */

export function CircleCard({ circle, joined = false, buddyCount = 0 }) {
  return (
    <Link to={`/circles/${circle.slug}`} className="ccard">
      <span className={`ccard__ico tone-${circle.tone}`}>{circle.emoji}</span>
      <div className="ccard__body">
        <h3>
          {circle.name}
          {joined && <i className="ccard__joined">已加入</i>}
        </h3>
        <p>{circle.desc}</p>
        <div className="ccard__tags">
          {circle.tags.map((t) => (
            <Tag key={t} tone="plain">
              #{t}
            </Tag>
          ))}
        </div>
        <div className="ccard__foot">
          <span>
            <Icon name="users" size={14} />
            {circle.members} 人加入
          </span>
          <span className="ccard__week">{buddyCount} 个在招搭子</span>
        </div>
      </div>
    </Link>
  )
}

/* ---------------- 用户卡 ---------------- */

export function PersonCard({ person, score, reasons = [], onChat, onRequest, requested = false, friend = false }) {
  return (
    <article className="pcard">
      <div className="pcard__head">
        <Avatar name={person.nickname} seed={person.nickname} size={46} online={person.online} />
        <div className="pcard__id">
          <h3>
            {person.nickname}
            {friend && <i className="pcard__friend">好友</i>}
          </h3>
          <p>
            {person.grade} · {person.major} · {person.campus}
          </p>
        </div>
        {typeof score === 'number' && <ScoreRing score={score} size={52} />}
      </div>

      <p className="pcard__bio">{person.bio}</p>

      <div className="pcard__tags">
        {person.tags.map((t) => (
          <Tag key={t} tone="plain">
            #{t}
          </Tag>
        ))}
      </div>

      {reasons.length > 0 && (
        <ul className="pcard__why">
          {reasons.map((r) => (
            <li key={r}>
              <Icon name="sparkles" size={13} />
              {r}
            </li>
          ))}
        </ul>
      )}

      <div className="pcard__foot">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChat?.(person)}>
          <Icon name="chat" size={15} /> 聊天
        </button>
        <button
          type="button"
          className={`btn btn--sm ${friend ? 'btn--ghost' : 'btn--primary'}`}
          onClick={() => onRequest?.(person)}
          disabled={requested || friend}
        >
          <Icon name="user" size={15} /> {friend ? '已是好友' : requested ? '申请中' : '打招呼'}
        </button>
      </div>
    </article>
  )
}
