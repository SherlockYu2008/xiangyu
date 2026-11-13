import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { Avatar, Empty, Progress, ScoreRing, Tag, useToast } from '../components/ui'
import { STYLES, TAG_POOL } from '../lib/data'
import { pickRandom, rankDeep, rankMatches, reasons, sharedTags } from '../lib/match'
import { AI_DAILY_LIMIT, aiQuota, runAiDemo, sendRequest, startChat, useStore } from '../lib/store'

const TOPIC_POOL = ['音乐', '运动', '技术', '读书', '电影', '游戏', '美食', '旅行', '科研', '毕业去向', '校园生活', '自我管理']

const TABS = [
  { key: 'interest', label: '兴趣同频', icon: 'sparkles', hint: '标签重合度，最快' },
  { key: 'random', label: '随机匹配', icon: 'refresh', hint: '在线的人里随机' },
  { key: 'deep', label: '深度同频', icon: 'compass', hint: '话题 + 偏好加权' },
]

export default function Match() {
  const s = useStore()
  const nav = useNavigate()
  const toast = useToast()
  const [tab, setTab] = useState('interest')

  /* 兴趣同频 */
  const [myTags, setMyTags] = useState(s.me?.tags || [])
  const interestList = useMemo(() => {
    const me = { ...s.me, tags: myTags }
    return rankMatches(me, s.people)
  }, [s.me, s.people, myTags])

  /* 随机匹配 */
  const [phase, setPhase] = useState('idle') // idle | searching | done
  const [randomPerson, setRandomPerson] = useState(null)
  const [seen, setSeen] = useState([])
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  const startRandom = () => {
    if (seen.length >= s.people.length) {
      toast('所有人都匹配过一轮了，换「深度同频」试试')
      return
    }
    setPhase('searching')
    timer.current = setTimeout(() => {
      const p = pickRandom(s.people, seen)
      if (!p) {
        setPhase('idle')
        return
      }
      setRandomPerson(p)
      setSeen((list) => [...list, p.id])
      setPhase('done')
    }, 2000)
  }

  /* 深度同频 */
  const [prefs, setPrefs] = useState({
    topics: s.me?.topics || [],
    style: s.me?.style || '慢热',
    depth: s.me?.depth || 3,
    lookingFor: s.me?.lookingFor || '',
  })
  const [deepRan, setDeepRan] = useState(false)
  const deepList = useMemo(() => rankDeep(s.me, s.people, prefs).slice(0, 5), [s.me, s.people, prefs])

  /* AI 增强（演示） */
  const [aiOut, setAiOut] = useState(null)
  const quota = aiQuota(s)

  const runAi = (feature) => {
    const me = s.me
    const args =
      feature === 'icebreaker'
        ? [me.tags, me.lookingFor]
        : feature === 'explain'
          ? [sharedTags(me.tags, s.people[0]?.tags || ['羽毛球'])]
          : feature === 'summary'
            ? [me.tags]
            : []
    const res = runAiDemo(feature, args)
    if (!res.ok) {
      setAiOut({ title: '额度用完了', lines: [res.reason] })
      return
    }
    setAiOut({
      title: { icebreaker: '破冰话题', explain: '共同点解释', summary: '兴趣总结', topic_suggest: '话题建议' }[feature],
      lines: res.lines,
    })
  }

  const chat = (person) => {
    const id = startChat(person.id)
    if (id) nav(`/messages/${id}`)
  }

  const request = (person) => {
    sendRequest(person.id, '同频度挺高的，交个朋友')
    toast(`已向 ${person.nickname} 发出好友申请`)
  }

  const invite = async () => {
    const url = window.location.origin + window.location.pathname
    try {
      await navigator.clipboard.writeText(url)
      toast('网址已复制，发给同学让他们来注册')
    } catch {
      toast(url)
    }
  }

  if (!s.me) return null

  return (
    <div className="page">
      <header className="pagehead">
        <div>
          <span className="eyebrow">同频匹配</span>
          <h1>三种方式，认识对的人</h1>
          <p>全部由普通程序算出来：不排队等 AI，不消耗额度，断网恢复后照样能用。</p>
        </div>
      </header>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? 'is-on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={17} />
            <b>{t.label}</b>
            <span>{t.hint}</span>
          </button>
        ))}
      </div>

      {tab === 'interest' && (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>你的兴趣标签</h3>
              <p>点一下就能改，改完分数立刻变。这就是它比 AI 便宜的原因。</p>
            </div>
            <span className="pill">{myTags.length} 个标签</span>
          </div>

          <div className="tagpool">
            {[...new Set([...s.me.tags, ...TAG_POOL])].map((t) => (
              <Tag
                key={t}
                tone={myTags.includes(t) ? 'brand' : 'plain'}
                active={myTags.includes(t)}
                onClick={() =>
                  setMyTags((list) =>
                    list.includes(t) ? list.filter((x) => x !== t) : list.length >= 8 ? list : [...list, t],
                  )
                }
              >
                {t}
              </Tag>
            ))}
          </div>

          <div className="resultlist">
            {interestList.length === 0 && (
              <Empty
                icon="users"
                title="还没有其他真人"
                desc="匹配池里只有真实注册的用户，现在一个人都还没有。把网址发给同学再来。"
                action={
                  <button type="button" className="btn btn--ghost btn--sm" onClick={invite}>
                    复制网址去邀人
                  </button>
                }
              />
            )}
            {interestList.slice(0, 5).map(({ person, score }, i) => (
              <article className="rowcard" key={person.id}>
                <span className="rowcard__rank">{String(i + 1).padStart(2, '0')}</span>
                <Avatar name={person.nickname} seed={person.nickname} size={44} online={person.online} />
                <div className="rowcard__main">
                  <div className="rowcard__name">
                    <b>{person.nickname}</b>
                    <span>
                      {person.grade} · {person.major} · {person.campus}
                    </span>
                  </div>
                  <ul className="rowcard__why">
                    {reasons(s.me, person, 2).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
                <div className="rowcard__right">
                  <ScoreRing score={score} size={50} />
                  <button type="button" className="btn btn--soft btn--sm" onClick={() => chat(person)}>
                    聊天
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'random' && (
        <section className="random">
          <div className="random__stage">
            {s.people.length === 0 ? (
              <Empty
                icon="users"
                title="随机池是空的"
                desc="没有机器人可以“随机”给你。等有真人注册，他们就会进入这个池子。"
                action={
                  <button type="button" className="btn btn--ghost btn--sm" onClick={invite}>
                    复制网址去邀人
                  </button>
                }
              />
            ) : null}
            {phase === 'idle' && s.people.length > 0 && (
              <>
                <div className="random__orb">
                  <Icon name="refresh" size={34} />
                </div>
                <h2>从在线的人里，随机抽一个</h2>
                <p>当前在线 {s.people.filter((p) => p.online).length} 人 · 已经匹配过 {seen.length} 人</p>
                <button type="button" className="btn btn--primary btn--lg" onClick={startRandom}>
                  开始匹配
                </button>
                <p className="random__note">随机匹配不调用 AI，也不会把学号之类的东西暴露出去。</p>
              </>
            )}

            {phase === 'searching' && (
              <>
                <div className="random__orb is-spin">
                  <Icon name="refresh" size={34} />
                </div>
                <h2>正在找同频的人…</h2>
                <p>按标签、校区、在线状态筛一遍</p>
                <div className="random__bar">
                  <Progress value={1} max={1} />
                </div>
              </>
            )}

            {phase === 'done' && randomPerson && (
              <div className="random__result">
                <Avatar name={randomPerson.nickname} seed={randomPerson.nickname} size={84} ring online />
                <h2>{randomPerson.nickname}</h2>
                <p className="random__meta">
                  {randomPerson.grade} · {randomPerson.major} · {randomPerson.campus}
                </p>
                <p className="random__bio">{randomPerson.bio}</p>
                <div className="random__tags">
                  {randomPerson.tags.map((t) => (
                    <Tag key={t} tone={s.me.tags.includes(t) ? 'brand' : 'plain'}>
                      #{t}
                    </Tag>
                  ))}
                </div>
                <ul className="random__why">
                  {reasons(s.me, randomPerson, 3).map((r) => (
                    <li key={r}>
                      <Icon name="check" size={14} /> {r}
                    </li>
                  ))}
                </ul>
                <div className="random__btns">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => {
                      setPhase('idle')
                      setRandomPerson(null)
                    }}
                  >
                    换一个
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => request(randomPerson)}>
                    打招呼
                  </button>
                  <button type="button" className="btn btn--primary" onClick={() => chat(randomPerson)}>
                    <Icon name="chat" size={16} /> 开始聊天
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'deep' && (
        <section className="panel">
          <div className="panel__head">
            <div>
              <h3>填几道题，算得更准</h3>
              <p>权重：兴趣 50% / 话题 20% / 交流偏好 15% / 讨论深度 15%</p>
            </div>
          </div>

          <div className="deepform">
            <div className="field">
              <span>想聊的话题</span>
              <div className="tagpool">
                {TOPIC_POOL.map((t) => (
                  <Tag
                    key={t}
                    tone={prefs.topics.includes(t) ? 'brand' : 'plain'}
                    active={prefs.topics.includes(t)}
                    onClick={() =>
                      setPrefs((p) => ({
                        ...p,
                        topics: p.topics.includes(t) ? p.topics.filter((x) => x !== t) : [...p.topics, t],
                      }))
                    }
                  >
                    {t}
                  </Tag>
                ))}
              </div>
            </div>

            <div className="field-row">
              <label className="field">
                <span>交流偏好</span>
                <select value={prefs.style} onChange={(e) => setPrefs({ ...prefs, style: e.target.value })}>
                  {STYLES.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>讨论深度 {prefs.depth}/5</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={prefs.depth}
                  onChange={(e) => setPrefs({ ...prefs, depth: Number(e.target.value) })}
                />
              </label>
            </div>

            <label className="field">
              <span>想认识什么样的人</span>
              <input
                maxLength={30}
                value={prefs.lookingFor}
                placeholder="比如：能一起长期打球的人"
                onChange={(e) => setPrefs({ ...prefs, lookingFor: e.target.value })}
              />
            </label>

            <button type="button" className="btn btn--primary" onClick={() => setDeepRan(true)}>
              <Icon name="sparkles" size={16} /> 计算匹配
            </button>
          </div>

          {deepRan && (
            <div className="resultlist resultlist--deep">
              {deepList.length === 0 && (
                <Empty
                  icon="users"
                  title="还算不出结果"
                  desc="深度同频要拿真人来比，现在还没有第二个注册的人。"
                  action={
                    <button type="button" className="btn btn--ghost btn--sm" onClick={invite}>
                      复制网址去邀人
                    </button>
                  }
                />
              )}
              {deepList.map(({ person, total, parts }, i) => (
                <article className="deepcard" key={person.id}>
                  <span className="rowcard__rank">{String(i + 1).padStart(2, '0')}</span>
                  <Avatar name={person.nickname} seed={person.nickname} size={42} online={person.online} />
                  <div className="deepcard__main">
                    <div className="rowcard__name">
                      <b>{person.nickname}</b>
                      <span>{person.grade} · {person.major}</span>
                    </div>
                    <div className="deepcard__parts">
                      {Object.entries(parts).map(([k, v]) => (
                        <div className="part" key={k}>
                          <span>{k}</span>
                          <Progress value={v} max={100} tone="soft" />
                          <b>{v}</b>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rowcard__right">
                    <ScoreRing score={total} size={50} label="匹配" />
                    <button type="button" className="btn btn--soft btn--sm" onClick={() => chat(person)}>
                      聊天
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="aipanel">
        <div className="aipanel__head">
          <div>
            <h3>
              <Icon name="sparkles" size={17} /> AI 可选增强
            </h3>
            <p>只有你点下面的按钮才会触发。真实版本走后端 Edge Function，带次数、预算和缓存三重限制。</p>
          </div>
          <span className={`pill ${quota === 0 ? 'pill--warn' : ''}`}>
            今日额度 {AI_DAILY_LIMIT - quota}/{AI_DAILY_LIMIT}
          </span>
        </div>

        <div className="aipanel__btns">
          <button type="button" className="btn btn--soft btn--sm" onClick={() => runAi('icebreaker')}>
            生成破冰话题
          </button>
          <button type="button" className="btn btn--soft btn--sm" onClick={() => runAi('explain')}>
            解释共同点
          </button>
          <button type="button" className="btn btn--soft btn--sm" onClick={() => runAi('summary')}>
            兴趣总结
          </button>
          <button type="button" className="btn btn--soft btn--sm" onClick={() => runAi('topic_suggest')}>
            话题建议
          </button>
        </div>

        {aiOut && (
          <div className="aipanel__out">
            <b>{aiOut.title}</b>
            <ul>
              {aiOut.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <span className="aipanel__tag">演示模式：本地模板生成，未调用 DeepSeek</span>
          </div>
        )}

        {quota === 0 && (
          <Empty icon="shield" title="今天 3 次额度用完了" desc="普通功能完全不受影响，明天 0 点重置。这就是低成本设计该有的样子。" />
        )}
      </section>
    </div>
  )
}
