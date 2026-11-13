import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Icon from '../components/Icon'
import BuddyDetail from '../components/BuddyDetail'
import CreateBuddy from '../components/CreateBuddy'
import { BuddyCard } from '../components/cards'
import { Avatar, Empty, Tag } from '../components/ui'
import { circleBySlug, joinCircle, leaveCircle, personById, useStore } from '../lib/store'

export default function CircleDetail() {
  const { slug } = useParams()
  const s = useStore()
  const [buddyId, setBuddyId] = useState(null)
  const [creating, setCreating] = useState(false)

  const circle = circleBySlug(s, slug)
  if (!circle) {
    return (
      <div className="page">
        <Empty
          icon="grid"
          title="这个圈子不存在"
          desc="可能是链接过期了，回兴趣圈列表看看。"
          action={
            <Link to="/circles" className="btn btn--primary btn--sm">
              回到兴趣圈
            </Link>
          }
        />
      </div>
    )
  }

  const buddies = s.buddies.filter((b) => b.circle === circle.slug)
  const joined = s.myCircles.includes(circle.slug)
  const authors = [...new Set(buddies.map((b) => b.author))].map((id) => personById(s, id)).filter(Boolean)

  return (
    <div className="page">
      <Link to="/circles" className="backlink">
        <Icon name="arrowLeft" size={15} /> 全部兴趣圈
      </Link>

      <header className={`circlehero circlehero--${circle.tone}`}>
        <div className="circlehero__ico">{circle.emoji}</div>
        <div className="circlehero__body">
          <div className="circlehero__title">
            <h1>{circle.name}</h1>
          </div>
          <p>{circle.desc}</p>
          <div className="circlehero__tags">
            {circle.tags.map((t) => (
              <Tag key={t} tone="plain">
                #{t}
              </Tag>
            ))}
          </div>
          <div className="circlehero__meta">
            <span>
              <Icon name="users" size={15} /> {circle.members} 人加入
            </span>
            <span>
              <Icon name="grid" size={15} /> {buddies.length} 个在招搭子
            </span>
          </div>
        </div>
        <div className="circlehero__actions">
          <button
            type="button"
            className={`btn ${joined ? 'btn--ghost' : 'btn--primary'}`}
            onClick={() => (joined ? leaveCircle(circle.slug) : joinCircle(circle.slug))}
          >
            {joined ? (
              <>
                <Icon name="check" size={16} /> 已加入
              </>
            ) : (
              <>
                <Icon name="plus" size={16} /> 加入圈子
              </>
            )}
          </button>
          <button type="button" className="btn btn--soft" onClick={() => setCreating(true)}>
            发起搭子
          </button>
        </div>
      </header>

      <section className="block">
        <div className="secthead">
          <div>
            <h2>正在招的搭子</h2>
            <p>{joined ? '你已在这个圈子里，可以直接加入任意搭子' : '加入圈子只是个标记，加入搭子才会真的约起来'}</p>
          </div>
        </div>

        {buddies.length === 0 ? (
          <Empty
            icon="plus"
            title="这个圈子还没有搭子"
            desc="第一个开局的往往能挑到最好的人。"
            action={
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
                我来发起第一个
              </button>
            }
          />
        ) : (
          <div className="grid grid--2">
            {buddies.map((b) => (
              <BuddyCard key={b.id} buddy={b} onOpen={(x) => setBuddyId(x.id)} />
            ))}
          </div>
        )}
      </section>

      <div className="twocol">
        <section className="panel">
          <h3>圈子守则</h3>
          <p className="panel__text">{circle.rules}</p>
          <p className="panel__note">
            <Icon name="shield" size={14} />
            平台不做人工审核，遇到骚扰请直接拉黑 + 举报，我们会留档。
          </p>
        </section>

        <section className="panel">
          <h3>圈子里活跃的人</h3>
          <div className="people-row">
            {authors.map((p) => (
              <Link to="/discover" key={p.id} className="people-row__item">
                <Avatar name={p.nickname} seed={p.nickname} size={38} online={p.online} />
                <b>{p.nickname}</b>
                <span>{p.grade}</span>
              </Link>
            ))}
            {authors.length === 0 && <p className="panel__text">还没有人发搭子。</p>}
          </div>
        </section>
      </div>

      <BuddyDetail buddyId={buddyId} onClose={() => setBuddyId(null)} />
      <CreateBuddy open={creating} onClose={() => setCreating(false)} defaultCircle={circle.slug} />
    </div>
  )
}
