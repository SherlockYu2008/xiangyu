import { useMemo, useState } from 'react'
import Icon from '../components/Icon'
import BuddyDetail from '../components/BuddyDetail'
import CreateBuddy from '../components/CreateBuddy'
import { BuddyCard, CircleCard } from '../components/cards'
import { Empty, Tag } from '../components/ui'
import { useStore } from '../lib/store'

const CATS = ['全部', '学习考证', '运动健身', '文艺生活', '技术极客', '游戏电竞', '吃喝玩乐', '户外旅行']

export default function Circles() {
  const s = useStore()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('全部')
  const [tab, setTab] = useState('all')
  const [showAllCircles, setShowAllCircles] = useState(false)
  const [buddyId, setBuddyId] = useState(null)
  const [creating, setCreating] = useState(false)

  const buddyList = useMemo(() => {
    const kw = q.trim()
    return s.buddies.filter((b) => {
      if (tab === 'mine' && !b.members.includes(s.me?.id)) return false
      if (cat !== '全部') {
        const circle = s.circles.find((c) => c.slug === b.circle)
        if (circle?.category !== cat) return false
      }
      if (!kw) return true
      const circle = s.circles.find((c) => c.slug === b.circle)
      return (
        b.title.includes(kw) ||
        b.intro.includes(kw) ||
        b.place.includes(kw) ||
        b.tags.some((t) => t.includes(kw)) ||
        (circle && circle.name.includes(kw))
      )
    })
  }, [s.buddies, s.circles, q, cat, tab])

  const circleList = useMemo(() => {
    if (cat === '全部') return s.circles
    return s.circles.filter((c) => c.category === cat)
  }, [s.circles, cat])

  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">兴趣圈 · 找搭子</span>
          <h1>先找圈子，再找搭子</h1>
          <p>圈子负责分类，搭子负责那件具体的事。四级、羽毛球、吉他、剧本杀，都在这儿。</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={17} /> 发起搭子
        </button>
      </header>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" size={17} />
          <input
            value={q}
            placeholder="搜搭子、地点、标签，比如「四级」「体育馆」"
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button type="button" className="search__clear" onClick={() => setQ('')} aria-label="清空">
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        <div className="seg">
          <button type="button" className={tab === 'all' ? 'is-on' : ''} onClick={() => setTab('all')}>
            全部搭子
          </button>
          <button type="button" className={tab === 'mine' ? 'is-on' : ''} onClick={() => setTab('mine')}>
            我加入的
          </button>
        </div>
      </div>

      <div className="chips">
        {CATS.map((c) => (
          <Tag key={c} tone={cat === c ? 'brand' : 'plain'} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Tag>
        ))}
      </div>

      <section className="block">
        <div className="secthead">
          <div>
            <h2>兴趣圈</h2>
            <p>{circleList.length} 个圈子，点进去看这个圈子里正在招的搭子</p>
          </div>
        </div>
        <div className="grid grid--2">
          {(showAllCircles ? circleList : circleList.slice(0, 4)).map((c) => (
            <CircleCard
              key={c.slug}
              circle={c}
              joined={s.myCircles.includes(c.slug)}
              buddyCount={s.buddies.filter((b) => b.circle === c.slug).length}
            />
          ))}
        </div>
        {circleList.length > 4 && (
          <button type="button" className="morebtn" onClick={() => setShowAllCircles((v) => !v)}>
            {showAllCircles ? '收起' : `展开全部 ${circleList.length} 个圈子`}
            <Icon name={showAllCircles ? 'arrowLeft' : 'arrowRight'} size={14} />
          </button>
        )}
      </section>

      <section className="block">
        <div className="secthead">
          <div>
            <h2>{tab === 'mine' ? '我加入的搭子' : '正在招人的搭子'}</h2>
            <p>共 {buddyList.length} 个 · 加入后可以在「消息」里直接私信发起人</p>
          </div>
        </div>

        {buddyList.length === 0 ? (
          <Empty
            icon="grid"
            title={tab === 'mine' ? '还没加入任何搭子' : '没有找到匹配的搭子'}
            desc={tab === 'mine' ? '去列表里挑一个，或者自己发起一个，等人来上车。' : '换个关键词，或者干脆自己发起一个。'}
            action={
              <div className="empty__btns">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setTab('all'); setQ(''); setCat('全部') }}>
                  看全部搭子
                </button>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setCreating(true)}>
                  发起一个
                </button>
              </div>
            }
          />
        ) : (
          <div className="grid grid--2">
            {buddyList.map((b) => (
              <BuddyCard key={b.id} buddy={b} onOpen={(x) => setBuddyId(x.id)} />
            ))}
          </div>
        )}
      </section>

      <section className="callout">
        <div>
          <h3>没找到你要的搭子？</h3>
          <p>自己做局更快。写清楚「什么事、什么时间、几个人、在哪」，比发一句“有人吗”有用得多。</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={17} /> 发起搭子
        </button>
      </section>

      <BuddyDetail buddyId={buddyId} onClose={() => setBuddyId(null)} />
      <CreateBuddy open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
