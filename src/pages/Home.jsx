import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Empty, Tag } from '../components/ui'
import { Composer, PostCard } from '../components/social'
import { Reveal } from '../components/FX'
import { fmtRelative } from '../lib/time'
import {
  circleBySlug,
  friendSuggestions,
  statsOf,
  useStore,
  visiblePosts,
} from '../lib/store'

export default function Home() {
  const s = useStore()
  const [scope, setScope] = useState('friends')
  const posts = useMemo(() => visiblePosts(s, scope), [s, scope])
  const sugg = useMemo(() => friendSuggestions(s, 4), [s])
  const stats = statsOf(s, s.me?.id)
  const buddies = useMemo(
    () => [...s.buddies].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3),
    [s.buddies],
  )

  if (!s.me) return null

  return (
    <div className="page">
      <div className="feedwrap">
        <main className="feedmain">
          <Reveal>
            <Composer />
          </Reveal>

          <Reveal delay={60}>
            <div className="feedtabs">
              <button type="button" className={scope === 'friends' ? 'is-on' : ''} onClick={() => setScope('friends')}>
                好友新鲜事
              </button>
              <button type="button" className={scope === 'all' ? 'is-on' : ''} onClick={() => setScope('all')}>
                全校新鲜事
              </button>
              <span className="feedtabs__count">{posts.length} 条</span>
            </div>
          </Reveal>

          {s.announcement?.text && (
            <div className="announce-bar">
              <b>📢 公告</b>
              <span>{s.announcement.text}</span>
              <i>{s.announcement.by}</i>
            </div>
          )}

          {posts.length === 0 ? (
            <Reveal delay={120}>
              <Empty
                icon="sparkles"
                title={scope === 'friends' ? '好友动态还是空的' : '全校还没有新鲜事'}
                desc={
                  s.friends.length === 0
                    ? '你还没有好友。去「朋友」页加几个同学，他们的动态就会出现在这里。'
                    : '发第一条动态，或者去朋友页看看同学在干嘛。'
                }
                action={
                  <Link to="/friends" className="btn btn--primary btn--sm">
                    去加同学
                  </Link>
                }
              />
            </Reveal>
          ) : (
            <div className="feedlist">
              {posts.map((p, i) => (
                <Reveal key={p.id} delay={Math.min(i, 4) * 70}>
                  <PostCard post={p} />
                </Reveal>
              ))}
            </div>
          )}
        </main>

        <aside className="rail">
          <section className="railcard railcard--me">
            <Link to="/u/me" className="railme">
              <Avatar name={s.me.nickname} seed={s.me.nickname} size={56} ring online />
              <div>
                <b>{s.me.nickname}</b>
                <span>
                  {s.me.grade} · {s.me.major}
                </span>
              </div>
            </Link>
            <p className="railcard__bio">{s.me.bio}</p>
            <div className="railstats">
              <Link to="/friends">
                <b>{stats.friends}</b>
                <span>好友</span>
              </Link>
              <Link to="/diary">
                <b>{stats.diaries}</b>
                <span>日志</span>
              </Link>
              <Link to="/albums">
                <b>{stats.photos}</b>
                <span>照片</span>
              </Link>
            </div>
          </section>

          <section className="railcard">
            <div className="railcard__head">
              <h3>可能认识的人</h3>
              <Link to="/friends">全部</Link>
            </div>
            {sugg.length === 0 ? (
              <p className="railcard__empty">
                {s.people.length === 0 ? '还没有其他真人注册，把网址发给同学吧。' : '能加的人都加过了。'}
              </p>
            ) : (
              <ul className="railfriends">
                {sugg.map(({ person, shared }) => (
                  <li key={person.id}>
                    <Link to={`/u/${person.id}`}>
                      <Avatar name={person.nickname} seed={person.nickname} size={32} />
                      <div>
                        <b>{person.nickname}</b>
                        <span>
                          {person.major}
                          {shared.length ? ` · 同好 ${shared.length}` : ''}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="railcard">
            <div className="railcard__head">
              <h3>在招的搭子</h3>
              <Link to="/circles">全部</Link>
            </div>
            {buddies.length === 0 ? (
              <p className="railcard__empty">还没有人发搭子。</p>
            ) : (
              <ul className="raildazi">
                {buddies.map((b) => {
                  const c = circleBySlug(s, b.circle)
                  return (
                    <li key={b.id}>
                      <Link to={`/circles/${b.circle}`}>
                        <span className={`raildazi__ico tone-${c?.tone || 'violet'}`}>{c?.emoji}</span>
                        <div>
                          <b>{b.title}</b>
                          <span>
                            {b.members.length}/{b.capacity} 人 · {fmtRelative(b.createdAt)}
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="railcard">
            <div className="railcard__head">
              <h3>我的标签</h3>
              <Link to="/me">编辑</Link>
            </div>
            <div className="tagpool">
              {s.me.tags.map((t) => (
                <Tag key={t} tone="plain">
                  #{t}
                </Tag>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
